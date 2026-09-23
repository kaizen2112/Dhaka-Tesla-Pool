import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RideRequest, RideStatus } from '@prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { DomainException } from '../../common/exceptions/domain.exception';
import { ACTIVE_POOL_STATUSES } from '../../common/ride-status';
import { PrismaService } from '../../prisma/prisma.service';
import { FareService } from '../fares/fare.service';
import { CreateRideRequestDto } from './dto/create-ride-request.dto';
import { MatchingService, MatchRejection, RiderTrip } from './matching.service';
import { RideStateService } from './ride-state.service';

// The driver-triggered pool steps (docs/ARCHITECTURE.md §4.3).
export type PoolStep = 'DRIVER_ARRIVED' | 'STARTED' | 'COMPLETED';

interface LockedPool {
  id: string;
  status: RideStatus;
  capacity: number;
  occupiedSeats: number;
  pickupZone: string;
}

interface LockedVehicle {
  id: string;
  capacity: number;
  isOnline: boolean;
}

// How a failed join surfaces on driver accept (docs/API_SPEC.md → error table).
// POOL_NOT_OPEN means the pool moved past MATCHED between the vehicle lock and the pool lock.
const ACCEPT_REJECTIONS: Record<MatchRejection, { code: string; status: HttpStatus; message: string }> = {
  POOL_NOT_OPEN: {
    code: 'ACTIVE_POOL_EXISTS',
    status: HttpStatus.CONFLICT,
    message: 'Your current pool is no longer taking passengers',
  },
  CAPACITY_EXCEEDED: {
    code: 'CAPACITY_EXCEEDED',
    status: HttpStatus.CONFLICT,
    message: 'Not enough free seats for this request',
  },
  PICKUP_TOO_FAR: {
    code: 'PICKUP_TOO_FAR',
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "This pickup is more than 2 km from your pool's pickup",
  },
  EXTRA_DISTANCE_TOO_HIGH: {
    code: 'EXTRA_DISTANCE_TOO_HIGH',
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Adding this passenger would take someone more than 2 km out of their way',
  },
};

type JoinOutcome =
  | { joined: true; farePoysha: number; score: number }
  | { joined: false; reason: MatchRejection };

type MatchSummary =
  | { matched: true; score: number }
  | { matched: false; reason: MatchRejection | 'NO_OPEN_POOLS' };

// When nothing joins, report the rejection that got furthest through MatchingService's checks —
// it best explains why the passenger is waiting. POOL_NOT_OPEN is internal-only (API_SPEC).
const WAIT_REASON_PRECEDENCE: MatchRejection[] = [
  'EXTRA_DISTANCE_TOO_HIGH',
  'PICKUP_TOO_FAR',
  'CAPACITY_EXCEEDED',
];

function toTrip(member: {
  seats: number;
  rideRequest: { pickupZone: string; destinationZone: string };
}): RiderTrip {
  return {
    pickupZone: member.rideRequest.pickupZone,
    destinationZone: member.rideRequest.destinationZone,
    seats: member.seats,
  };
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// Co-riders see each other's first name only (docs/API_SPEC.md → GET /pools/:id).
function firstName(name: string) {
  return name.split(' ')[0];
}

function stateChanged(): DomainException {
  return new DomainException(
    'INVALID_TRANSITION',
    HttpStatus.CONFLICT,
    'The ride changed while you were acting on it. Refresh and try again',
  );
}

// The only writer of RideRequest / Pool / PoolMembership / RideStatusHistory
// (docs/ARCHITECTURE.md §2). Every write happens inside one transaction.
@Injectable()
export class RidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
    private readonly fares: FareService,
    private readonly rideState: RideStateService,
  ) {}

  // docs/ARCHITECTURE.md §4.1
  async createRequest(passengerId: string, dto: CreateRideRequestDto) {
    if (dto.pickupZone === dto.destinationZone) {
      throw new DomainException(
        'VALIDATION_ERROR',
        HttpStatus.BAD_REQUEST,
        'Pickup and destination must be different zones',
      );
    }

    // Transaction A: the request + its "created" history row, in one nested write.
    let request: RideRequest;
    try {
      request = await this.prisma.rideRequest.create({
        data: {
          passengerId,
          pickupZone: dto.pickupZone,
          destinationZone: dto.destinationZone,
          seats: dto.seats,
          history: {
            create: { fromStatus: null, toStatus: 'REQUESTED', actorUserId: passengerId },
          },
        },
      });
    } catch (error) {
      // The ride_request_one_active_per_passenger partial unique index.
      if (isUniqueViolation(error)) {
        throw new DomainException(
          'ACTIVE_REQUEST_EXISTS',
          HttpStatus.CONFLICT,
          'You already have an active ride request',
        );
      }
      throw error;
    }

    const trip: RiderTrip = {
      pickupZone: request.pickupZone,
      destinationZone: request.destinationZone,
      seats: request.seats,
    };

    // Rank every open pool on an unlocked read. It can be stale; joinPool re-checks under lock.
    const openPools = await this.prisma.pool.findMany({
      where: { status: 'MATCHED' },
      include: {
        memberships: {
          where: { cancelledAt: null },
          orderBy: { joinedAt: 'asc' },
          include: { rideRequest: true },
        },
      },
    });

    const rejections: MatchRejection[] = [];
    const candidates: { poolId: string; score: number }[] = [];
    for (const pool of openPools) {
      const result = this.matching.canJoinPool(trip, {
        status: pool.status,
        capacity: pool.capacity,
        occupiedSeats: pool.occupiedSeats,
        pickupZone: pool.pickupZone,
        members: pool.memberships.map(toTrip),
      });
      if (result.matched) candidates.push({ poolId: pool.id, score: result.score });
      else rejections.push(result.reason);
    }
    candidates.sort((a, b) => a.score - b.score);

    // Best pool first, one transaction (one pool lock) per attempt. If someone took the last
    // seat since the ranking, the locked re-check fails and we move on to the next pool.
    for (const candidate of candidates) {
      const outcome = await this.prisma.$transaction((tx) =>
        this.joinPool(tx, request, candidate.poolId, passengerId),
      );
      if (outcome.joined) {
        return this.toCreateResponse(request.id, outcome.farePoysha, {
          matched: true,
          score: Math.round(outcome.score * 100) / 100,
        });
      }
      rejections.push(outcome.reason);
    }

    const solo = this.fares.calculate({ ...trip, shared: false });
    return this.toCreateResponse(request.id, solo.farePoysha, {
      matched: false,
      reason: WAIT_REASON_PRECEDENCE.find((r) => rejections.includes(r)) ?? 'NO_OPEN_POOLS',
    });
  }

  listMyRequests(passengerId: string) {
    return this.prisma.rideRequest.findMany({
      where: { passengerId },
      orderBy: { createdAt: 'desc' },
      include: {
        membership: {
          select: {
            id: true,
            poolId: true,
            seats: true,
            farePoysha: true,
            cancelledAt: true,
            paymentMethod: true,
            paidAt: true,
          },
        },
      },
    });
  }

  async getRequest(passengerId: string, requestId: string) {
    const request = await this.prisma.rideRequest.findUnique({
      where: { id: requestId },
      include: {
        membership: {
          include: {
            pool: {
              include: {
                vehicle: { include: { driver: true } },
                memberships: { where: { cancelledAt: null }, include: { passenger: true } },
              },
            },
          },
        },
      },
    });
    if (!request) throw new NotFoundException('Ride request not found');
    if (request.passengerId !== passengerId) {
      throw new ForbiddenException('This ride request is not yours');
    }

    const { membership } = request;
    const pool = membership?.pool;
    return {
      request: {
        id: request.id,
        pickupZone: request.pickupZone,
        destinationZone: request.destinationZone,
        seats: request.seats,
        status: request.status,
        createdAt: request.createdAt,
      },
      membership: membership && {
        id: membership.id,
        seats: membership.seats,
        farePoysha: membership.farePoysha,
        cancelledAt: membership.cancelledAt,
        paymentMethod: membership.paymentMethod,
        paidAt: membership.paidAt,
      },
      // Passenger view (API_SPEC → GET /pools/:id): co-riders' first names only, no fares.
      pool: pool && {
        id: pool.id,
        status: pool.status,
        vehicleName: pool.vehicle.name,
        driverName: pool.vehicle.driver.name,
        capacity: pool.capacity,
        occupiedSeats: pool.occupiedSeats,
        coRiders: pool.memberships
          .filter((m) => m.passengerId !== passengerId)
          .map((m) => firstName(m.passenger.name)),
      },
    };
  }

  // Waiting requests the driver's vehicle could take right now (docs/API_SPEC.md →
  // GET /ride-requests/pending). Not filtered by distance: vehicles have no location.
  async listPending(driverId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
      include: { pools: { where: { status: { in: ACTIVE_POOL_STATUSES } }, take: 1 } },
    });
    if (!vehicle) throw new NotFoundException('You have no vehicle yet');
    if (!vehicle.isOnline) return [];

    const activePool = vehicle.pools[0];
    if (activePool && activePool.status !== 'MATCHED') return [];
    const freeSeats = activePool
      ? activePool.capacity - activePool.occupiedSeats
      : vehicle.capacity;

    const requests = await this.prisma.rideRequest.findMany({
      where: { status: 'REQUESTED', seats: { lte: freeSeats } },
      orderBy: { createdAt: 'asc' },
      include: { passenger: true },
    });
    return requests.map((r) => ({
      id: r.id,
      passengerName: r.passenger.name,
      pickupZone: r.pickupZone,
      destinationZone: r.destinationZone,
      seats: r.seats,
      createdAt: r.createdAt,
    }));
  }

  // docs/ARCHITECTURE.md §4.2 / §8 acceptRequest. One transaction, lock order
  // Vehicle → Pool → RideRequest (the same order everywhere, so no deadlocks).
  acceptRequest(driverId: string, requestId: string) {
    return this.prisma.$transaction(async (tx) => {
      // The vehicle lock is what makes "one active pool per vehicle" safe: when a pool is about
      // to be created there's no pool row to lock yet. Two accept clicks run one after the
      // other, and the second sees the first one's pool and joins it.
      const [vehicle] = await tx.$queryRaw<LockedVehicle[]>`
        SELECT id, capacity, "isOnline" FROM "Vehicle" WHERE "driverId" = ${driverId} FOR UPDATE`;
      if (!vehicle) throw new NotFoundException('You have no vehicle yet');
      if (!vehicle.isOnline) {
        throw new DomainException('VEHICLE_OFFLINE', HttpStatus.CONFLICT, 'Go online before accepting rides');
      }

      const request = await tx.rideRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new NotFoundException('Ride request not found');

      const activePool = await tx.pool.findFirst({
        where: { vehicleId: vehicle.id, status: { in: ACTIVE_POOL_STATUSES } },
      });

      let poolId: string;
      if (!activePool) {
        poolId = await this.createPoolFromRequest(tx, vehicle, request, driverId);
      } else if (activePool.status === 'MATCHED') {
        const outcome = await this.joinPool(tx, request, activePool.id, driverId);
        if (!outcome.joined) {
          const { code, status, message } = ACCEPT_REJECTIONS[outcome.reason];
          throw new DomainException(code, status, message);
        }
        poolId = activePool.id;
      } else {
        throw new DomainException(
          'ACTIVE_POOL_EXISTS',
          HttpStatus.CONFLICT,
          'Finish your current trip before accepting new passengers',
        );
      }

      return this.toDriverPoolView(tx, poolId);
    });
  }

  // docs/ARCHITECTURE.md §4.3 / §8 transitionPool: arrived, start, complete.
  transitionPool(driverId: string, poolId: string, to: PoolStep) {
    return this.prisma.$transaction(async (tx) => {
      // Locks only the pool row (OF p), not the vehicle.
      const [pool] = await tx.$queryRaw<{ id: string; status: RideStatus; driverId: string }[]>`
        SELECT p.id, p.status, v."driverId"
        FROM "Pool" p JOIN "Vehicle" v ON v.id = p."vehicleId"
        WHERE p.id = ${poolId} FOR UPDATE OF p`;
      if (!pool) throw new NotFoundException('Pool not found');
      if (pool.driverId !== driverId) throw new ForbiddenException('This pool is not yours');

      this.rideState.assertTransition('pool', pool.status, to);

      const members = await tx.poolMembership.findMany({
        where: { poolId, cancelledAt: null },
        orderBy: { joinedAt: 'asc' },
        include: { rideRequest: true },
      });

      await tx.pool.update({ where: { id: poolId }, data: { status: to } });

      // Cascade: every active member's request moves with the pool. Cancelled members keep
      // CANCELLED. All of them must be at the pool's old status, or something is out of sync.
      const { count } = await tx.rideRequest.updateMany({
        where: { id: { in: members.map((m) => m.rideRequestId) }, status: pool.status },
        data: { status: to },
      });
      if (count !== members.length) throw stateChanged();

      await tx.rideStatusHistory.createMany({
        data: [
          { poolId, fromStatus: pool.status, toStatus: to, actorUserId: driverId },
          ...members.map((m) => ({
            poolId,
            rideRequestId: m.rideRequestId,
            fromStatus: pool.status,
            toStatus: to,
            actorUserId: driverId,
          })),
        ],
      });

      // Final fares (docs/ARCHITECTURE.md §7): recomputed for every active member, with
      // `shared` as the pool actually ended up. They never change after COMPLETED.
      if (to === 'COMPLETED') {
        const shared = members.length >= 2;
        for (const m of members) {
          const { farePoysha } = this.fares.calculate({ ...toTrip(m), shared });
          await tx.poolMembership.update({ where: { id: m.id }, data: { farePoysha } });
        }
      }

      return this.toDriverPoolView(tx, poolId);
    });
  }

  // docs/ARCHITECTURE.md §4.4 / §8 cancelRequest. Allowed from REQUESTED, MATCHED,
  // DRIVER_ARRIVED; never once the trip has STARTED.
  async cancelRequest(passengerId: string, requestId: string) {
    await this.prisma.$transaction(async (tx) => {
      const request = await tx.rideRequest.findUnique({
        where: { id: requestId },
        include: { membership: true },
      });
      if (!request) throw new NotFoundException('Ride request not found');
      if (request.passengerId !== passengerId) {
        throw new ForbiddenException('This ride request is not yours');
      }

      const membership = request.membership?.cancelledAt ? null : request.membership;

      if (!membership) {
        // Still waiting. If it gets matched meanwhile, the conditional update changes 0 rows.
        this.rideState.assertTransition('request', request.status, 'CANCELLED');
        const { count } = await tx.rideRequest.updateMany({
          where: { id: requestId, status: 'REQUESTED' },
          data: { status: 'CANCELLED' },
        });
        if (count !== 1) throw stateChanged();
        await tx.rideStatusHistory.create({
          data: {
            rideRequestId: requestId,
            fromStatus: 'REQUESTED',
            toStatus: 'CANCELLED',
            actorUserId: passengerId,
          },
        });
        return;
      }

      const [pool] = await tx.$queryRaw<{ id: string; status: RideStatus }[]>`
        SELECT id, status FROM "Pool" WHERE id = ${membership.poolId} FOR UPDATE`;

      // Re-read under the pool lock: every status change of a pooled request takes this lock,
      // so this is the real current status (the read above may be stale).
      const { status: from } = await tx.rideRequest.findUniqueOrThrow({
        where: { id: requestId },
        select: { status: true },
      });
      this.rideState.assertTransition('request', from, 'CANCELLED');

      await tx.rideRequest.update({ where: { id: requestId }, data: { status: 'CANCELLED' } });
      await tx.poolMembership.update({
        where: { id: membership.id },
        data: { cancelledAt: new Date() },
      });
      await tx.pool.update({
        where: { id: pool.id },
        data: { occupiedSeats: { decrement: membership.seats } },
      });
      await tx.rideStatusHistory.create({
        data: {
          rideRequestId: requestId,
          poolId: pool.id,
          fromStatus: from,
          toStatus: 'CANCELLED',
          actorUserId: passengerId,
        },
      });

      // Last active member gone → the pool itself is cancelled.
      const remaining = await tx.poolMembership.count({
        where: { poolId: pool.id, cancelledAt: null },
      });
      if (remaining === 0) {
        this.rideState.assertTransition('pool', pool.status, 'CANCELLED');
        await tx.pool.update({ where: { id: pool.id }, data: { status: 'CANCELLED' } });
        await tx.rideStatusHistory.create({
          data: {
            poolId: pool.id,
            fromStatus: pool.status,
            toStatus: 'CANCELLED',
            actorUserId: passengerId,
          },
        });
      }
    });

    return this.getRequest(passengerId, requestId);
  }

  // GET /pools/:id — the driver sees everything; a passenger sees the pool, co-riders' first
  // names and only their own membership + fare.
  async getPool(viewer: AuthUser, poolId: string) {
    const { pool, isDriver } = await this.loadPoolForViewer(viewer, poolId);
    if (isDriver) return this.toDriverPoolView(this.prisma, poolId);

    // A passenger who cancelled and re-booked into the same pool has two memberships; show the latest.
    const own = pool.memberships.filter((m) => m.passengerId === viewer.id).at(-1)!;
    return {
      id: pool.id,
      status: pool.status,
      vehicleName: pool.vehicle.name,
      driverName: pool.vehicle.driver.name,
      capacity: pool.capacity,
      occupiedSeats: pool.occupiedSeats,
      coRiders: pool.memberships
        .filter((m) => !m.cancelledAt && m.passengerId !== viewer.id)
        .map((m) => firstName(m.passenger.name)),
      myMembership: {
        id: own.id,
        rideRequestId: own.rideRequestId,
        seats: own.seats,
        farePoysha: own.farePoysha,
        cancelledAt: own.cancelledAt,
        paymentMethod: own.paymentMethod,
        paidAt: own.paidAt,
      },
    };
  }

  // Driver: every row with this poolId. Passenger: pool-level rows + their own request's rows
  // (including the "created" row from before the request joined the pool).
  async getPoolHistory(viewer: AuthUser, poolId: string) {
    const { pool, isDriver } = await this.loadPoolForViewer(viewer, poolId);
    const ownRequestIds = pool.memberships
      .filter((m) => m.passengerId === viewer.id)
      .map((m) => m.rideRequestId);

    return this.prisma.rideStatusHistory.findMany({
      where: isDriver
        ? { poolId }
        : { OR: [{ poolId, rideRequestId: null }, { rideRequestId: { in: ownRequestIds } }] },
      orderBy: { changedAt: 'asc' },
      select: {
        id: true,
        rideRequestId: true,
        fromStatus: true,
        toStatus: true,
        changedAt: true,
        actor: { select: { name: true } },
      },
    });
  }

  // Per-passenger breakdown recomputed by FareService; `farePoysha` is the stored figure
  // (the estimate until COMPLETED, then final). Driver: every active member; passenger: own.
  async getPoolFares(viewer: AuthUser, poolId: string) {
    const { pool, isDriver } = await this.loadPoolForViewer(viewer, poolId);
    const active = pool.memberships.filter((m) => !m.cancelledAt);
    const shared = active.length >= 2;
    const visible = isDriver ? active : active.filter((m) => m.passengerId === viewer.id);

    return {
      poolStatus: pool.status,
      final: pool.status === 'COMPLETED',
      fares: visible.map((m) => ({
        membershipId: m.id,
        passengerName: m.passenger.name,
        pickupZone: m.rideRequest.pickupZone,
        destinationZone: m.rideRequest.destinationZone,
        farePoysha: m.farePoysha,
        breakdown: this.fares.calculate({ ...toTrip(m), shared }),
      })),
    };
  }

  // Who may see a pool (docs/API_SPEC.md → Authorization): its driver, or a passenger who has
  // or had a membership in it. Anyone else — including other drivers — gets 403.
  private async loadPoolForViewer(viewer: AuthUser, poolId: string) {
    const pool = await this.prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        vehicle: { include: { driver: true } },
        memberships: {
          orderBy: { joinedAt: 'asc' },
          include: { passenger: true, rideRequest: true },
        },
      },
    });
    if (!pool) throw new NotFoundException('Pool not found');

    const isDriver = pool.vehicle.driverId === viewer.id;
    if (!isDriver && !pool.memberships.some((m) => m.passengerId === viewer.id)) {
      throw new ForbiddenException('You are not part of this pool');
    }
    return { pool, isDriver };
  }

  // The "no active pool" branch of acceptRequest: this request becomes the pool's anchor.
  private async createPoolFromRequest(
    tx: Prisma.TransactionClient,
    vehicle: LockedVehicle,
    request: RideRequest,
    driverId: string,
  ): Promise<string> {
    if (request.seats > vehicle.capacity) {
      throw new DomainException(
        'CAPACITY_EXCEEDED',
        HttpStatus.CONFLICT,
        'This request needs more seats than your vehicle has',
      );
    }

    const { count } = await tx.rideRequest.updateMany({
      where: { id: request.id, status: 'REQUESTED' },
      data: { status: 'MATCHED' },
    });
    if (count !== 1) {
      throw new DomainException(
        'INVALID_TRANSITION',
        HttpStatus.CONFLICT,
        'This ride request is no longer waiting',
      );
    }

    const { farePoysha } = this.fares.calculate({
      pickupZone: request.pickupZone,
      destinationZone: request.destinationZone,
      seats: request.seats,
      shared: false, // alone in the pool for now; finalized at complete (docs/ARCHITECTURE.md §7)
    });

    const pool = await tx.pool.create({
      data: {
        vehicleId: vehicle.id,
        pickupZone: request.pickupZone,
        destinationZone: request.destinationZone,
        capacity: vehicle.capacity, // snapshot, so the CHECK constraint needs no cross-table trigger
        occupiedSeats: request.seats,
        status: 'MATCHED',
        memberships: {
          create: {
            rideRequestId: request.id,
            passengerId: request.passengerId,
            seats: request.seats,
            farePoysha,
          },
        },
        history: { create: { fromStatus: null, toStatus: 'MATCHED', actorUserId: driverId } },
      },
    });
    await tx.rideStatusHistory.create({
      data: {
        rideRequestId: request.id,
        poolId: pool.id,
        fromStatus: 'REQUESTED',
        toStatus: 'MATCHED',
        actorUserId: driverId,
      },
    });
    return pool.id;
  }

  // Driver view of a pool (docs/API_SPEC.md → GET /pools/:id): every active member and fare.
  private async toDriverPoolView(tx: Prisma.TransactionClient, poolId: string) {
    const pool = await tx.pool.findUniqueOrThrow({
      where: { id: poolId },
      include: {
        vehicle: true,
        memberships: {
          where: { cancelledAt: null },
          orderBy: { joinedAt: 'asc' },
          include: { passenger: true, rideRequest: true },
        },
      },
    });
    return {
      id: pool.id,
      status: pool.status,
      vehicleName: pool.vehicle.name,
      pickupZone: pool.pickupZone,
      destinationZone: pool.destinationZone,
      capacity: pool.capacity,
      occupiedSeats: pool.occupiedSeats,
      members: pool.memberships.map((m) => ({
        membershipId: m.id,
        rideRequestId: m.rideRequestId,
        passengerName: m.passenger.name,
        pickupZone: m.rideRequest.pickupZone,
        destinationZone: m.rideRequest.destinationZone,
        seats: m.seats,
        farePoysha: m.farePoysha,
      })),
    };
  }

  // docs/ARCHITECTURE.md §8 joinPool. Takes the caller's transaction: auto-join opens one per
  // attempt, and acceptRequest calls it inside its own (after the vehicle lock).
  private async joinPool(
    tx: Prisma.TransactionClient,
    request: RideRequest,
    poolId: string,
    actorUserId: string,
  ): Promise<JoinOutcome> {
    const [pool] = await tx.$queryRaw<LockedPool[]>`
      SELECT id, status, capacity, "occupiedSeats", "pickupZone"
      FROM "Pool" WHERE id = ${poolId} FOR UPDATE`;

    // Stable while we hold the pool lock: every membership change takes this lock first.
    const members = await tx.poolMembership.findMany({
      where: { poolId, cancelledAt: null },
      orderBy: { joinedAt: 'asc' },
      include: { rideRequest: true },
    });

    // Re-check on the locked, fresh snapshot — this is what stops two passengers both taking
    // Bullet's last seat. The unlocked ranking read above is not enough on its own.
    const trip: RiderTrip = {
      pickupZone: request.pickupZone,
      destinationZone: request.destinationZone,
      seats: request.seats,
    };
    const result = this.matching.canJoinPool(trip, {
      status: pool.status,
      capacity: pool.capacity,
      occupiedSeats: pool.occupiedSeats,
      pickupZone: pool.pickupZone,
      members: members.map(toTrip),
    });
    if (!result.matched) return { joined: false, reason: result.reason };

    // Conditional update: if the passenger cancelled meanwhile, 0 rows change and we abort.
    const { count } = await tx.rideRequest.updateMany({
      where: { id: request.id, status: 'REQUESTED' },
      data: { status: 'MATCHED' },
    });
    if (count !== 1) {
      throw new DomainException(
        'INVALID_TRANSITION',
        HttpStatus.CONFLICT,
        'This ride request is no longer waiting',
      );
    }

    // Estimate with `shared` as the pool will be after this join (docs/ARCHITECTURE.md §7).
    const { farePoysha } = this.fares.calculate({ ...trip, shared: members.length + 1 >= 2 });

    await tx.poolMembership.create({
      data: {
        poolId,
        rideRequestId: request.id,
        passengerId: request.passengerId,
        seats: request.seats,
        farePoysha,
      },
    });
    await tx.pool.update({
      where: { id: poolId },
      data: { occupiedSeats: { increment: request.seats } },
    });
    await tx.rideStatusHistory.create({
      data: {
        rideRequestId: request.id,
        poolId,
        fromStatus: 'REQUESTED',
        toStatus: 'MATCHED',
        actorUserId,
      },
    });

    return { joined: true, farePoysha, score: result.score };
  }

  private async toCreateResponse(
    requestId: string,
    estimatedFarePoysha: number,
    matchResult: MatchSummary,
  ) {
    const request = await this.prisma.rideRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { membership: { include: { pool: { include: { vehicle: true } } } } },
    });
    const pool = request.membership?.pool;
    return {
      request: {
        id: request.id,
        pickupZone: request.pickupZone,
        destinationZone: request.destinationZone,
        seats: request.seats,
        status: request.status,
        createdAt: request.createdAt,
      },
      pool: pool
        ? {
            id: pool.id,
            status: pool.status,
            vehicleName: pool.vehicle.name,
            capacity: pool.capacity,
            occupiedSeats: pool.occupiedSeats,
          }
        : null,
      estimatedFarePoysha,
      matchResult,
    };
  }
}
