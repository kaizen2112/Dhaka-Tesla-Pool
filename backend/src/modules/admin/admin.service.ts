import { Injectable } from '@nestjs/common';
import { ComplaintStatus, UserRole } from '@prisma/client';
import { ACTIVE_POOL_STATUSES } from '../../common/ride-status';
import { PrismaService } from '../../prisma/prisma.service';
import { ratingAverage } from '../feedback/rating-summary';

const DHAKA_UTC_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC+6 all year, no daylight saving

// Midnight in Dhaka, whatever timezone the server runs in (containers usually run in UTC).
export function startOfDhakaDay(now = new Date()) {
  const day = 24 * 60 * 60 * 1000;
  return new Date(Math.floor((now.getTime() + DHAKA_UTC_OFFSET_MS) / day) * day - DHAKA_UTC_OFFSET_MS);
}

// Read-only numbers and lists for the admin panel (docs/ARCHITECTURE.md §2). It never writes:
// deciding a complaint goes through FeedbackService, and the trip list through RidesService.
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [passengers, drivers, driversOnline, activePools, tripsCompletedToday, collected, openComplaints] =
      await Promise.all([
        this.prisma.user.count({ where: { role: 'PASSENGER' } }),
        this.prisma.user.count({ where: { role: 'DRIVER' } }),
        this.prisma.vehicle.count({ where: { isOnline: true } }),
        this.prisma.pool.count({ where: { status: { in: ACTIVE_POOL_STATUSES } } }),
        // The pool-level history row is the record of when a trip completed.
        this.prisma.rideStatusHistory.count({
          where: { toStatus: 'COMPLETED', rideRequestId: null, changedAt: { gte: startOfDhakaDay() } },
        }),
        this.prisma.poolMembership.aggregate({ _sum: { farePoysha: true }, where: { paidAt: { not: null } } }),
        this.prisma.complaint.count({ where: { status: 'OPEN' } }),
      ]);
    return {
      users: { passengers, drivers },
      driversOnline,
      activePools,
      tripsCompletedToday,
      collectedPoysha: collected._sum.farePoysha ?? 0,
      openComplaints,
    };
  }

  async users(role?: UserRole) {
    const [users, ratings, openComplaints] = await Promise.all([
      this.prisma.user.findMany({
        where: { role },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
        include: {
          vehicle: { select: { name: true, capacity: true, isOnline: true } },
          wallet: { select: { balancePoysha: true } },
          _count: { select: { rideRequests: true } },
        },
      }),
      // One grouped query per figure, not one query per driver.
      this.prisma.rating.groupBy({ by: ['driverId'], _sum: { stars: true }, _count: { _all: true } }),
      this.prisma.complaint.groupBy({ by: ['driverId'], where: { status: 'OPEN' }, _count: { _all: true } }),
    ]);
    const ratingOf = new Map(ratings.map((r) => [r.driverId, r]));
    const openOf = new Map(openComplaints.map((c) => [c.driverId, c._count._all]));

    return users.map((u) => {
      const base = { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
      if (u.role === 'DRIVER') {
        const r = ratingOf.get(u.id);
        const count = r?._count._all ?? 0;
        return {
          ...base,
          vehicle: u.vehicle,
          rating: { average: ratingAverage(r?._sum.stars ?? 0, count), count },
          openComplaints: openOf.get(u.id) ?? 0,
        };
      }
      if (u.role === 'PASSENGER') {
        return { ...base, walletBalancePoysha: u.wallet?.balancePoysha ?? 0, rides: u._count.rideRequests };
      }
      return base;
    });
  }

  // The admin sees who complained about whom; the driver's own view hides the passenger.
  async complaints(status?: ComplaintStatus) {
    const complaints = await this.prisma.complaint.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: {
        passenger: { select: { name: true } },
        driver: { select: { name: true } },
        resolvedBy: { select: { name: true } },
        poolMembership: {
          select: {
            poolId: true,
            rideRequest: { select: { pickupZone: true, destinationZone: true } },
            pool: { select: { createdAt: true } },
          },
        },
      },
    });
    return complaints.map((c) => ({
      id: c.id,
      category: c.category,
      description: c.description,
      status: c.status,
      createdAt: c.createdAt,
      passengerName: c.passenger.name,
      driverName: c.driver.name,
      trip: {
        poolId: c.poolMembership.poolId,
        pickupZone: c.poolMembership.rideRequest.pickupZone,
        destinationZone: c.poolMembership.rideRequest.destinationZone,
        date: c.poolMembership.pool.createdAt,
      },
      resolutionNote: c.resolutionNote,
      resolvedBy: c.resolvedBy?.name ?? null,
      resolvedAt: c.resolvedAt,
    }));
  }
}
