import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RideRequest, RideStatus } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { FareService } from '../fares/fare.service';
import { CreateRideRequestDto } from './dto/create-ride-request.dto';
import { MatchingService, MatchRejection, RiderTrip } from './matching.service';

interface LockedPool {
  id: string;
  status: RideStatus;
  capacity: number;
  occupiedSeats: number;
  pickupZone: string;
}

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

// The only writer of RideRequest / Pool / PoolMembership / RideStatusHistory
// (docs/ARCHITECTURE.md §2). Every write happens inside one transaction.
@Injectable()
export class RidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
    private readonly fares: FareService,
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
          .map((m) => m.passenger.name.split(' ')[0]),
      },
    };
  }

  // docs/ARCHITECTURE.md §8 joinPool. Takes the caller's transaction: auto-join opens one per
  // attempt, and driver accept (commit 11) calls it inside its own.
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
