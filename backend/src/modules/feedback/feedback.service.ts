import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception';
import { isUniqueViolation } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { summarizeRatings } from './rating-summary';

// What the driver may see of a complaint. No passengerId, no names: the driver sees what was
// said, never who said it (docs/ADMIN_FEEDBACK_PLAN.md §2).
const DRIVER_COMPLAINT_FIELDS = {
  id: true,
  category: true,
  description: true,
  status: true,
  resolutionNote: true,
  createdAt: true,
  resolvedAt: true,
} as const;

// The only writer of Rating and Complaint, including the admin's resolve
// (docs/ARCHITECTURE.md §2). Reads memberships and pools, never writes them.
@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async rate(passengerId: string, membershipId: string, dto: CreateRatingDto) {
    const driverId = await this.driverOfCompletedTrip(passengerId, membershipId);
    try {
      return await this.prisma.rating.create({
        data: { poolMembershipId: membershipId, passengerId, driverId, stars: dto.stars, comment: dto.comment || null },
        select: { id: true, stars: true, comment: true, createdAt: true },
      });
    } catch (error) {
      // The unique poolMembershipId decides a double submit, not a check-then-insert.
      if (isUniqueViolation(error)) {
        throw new DomainException('ALREADY_RATED', HttpStatus.CONFLICT, 'You already rated this trip');
      }
      throw error;
    }
  }

  async complain(passengerId: string, membershipId: string, dto: CreateComplaintDto) {
    const driverId = await this.driverOfCompletedTrip(passengerId, membershipId);
    try {
      return await this.prisma.complaint.create({
        data: { poolMembershipId: membershipId, passengerId, driverId, category: dto.category, description: dto.description },
        select: { id: true, category: true, description: true, status: true, createdAt: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainException('ALREADY_REPORTED', HttpStatus.CONFLICT, 'You already reported this trip');
      }
      throw error;
    }
  }

  // GET /drivers/me/profile. The selects are the anonymity: nothing about the passenger is read.
  async driverProfile(driverId: string) {
    const [driver, ratings, complaints] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: driverId },
        select: { name: true, vehicle: { select: { name: true } } },
      }),
      this.prisma.rating.findMany({
        where: { driverId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, stars: true, comment: true, createdAt: true },
      }),
      this.prisma.complaint.findMany({
        where: { driverId },
        orderBy: { createdAt: 'desc' },
        select: DRIVER_COMPLAINT_FIELDS,
      }),
    ]);
    return {
      driver: { name: driver.name, vehicleName: driver.vehicle?.name ?? null },
      rating: summarizeRatings(ratings.map((r) => r.stars)),
      reviews: ratings.slice(0, 20),
      complaints,
    };
  }

  // The "★ 4.5 (2)" next to the driver's name on a passenger's ride.
  // ponytail: reads every star of the driver; cache ratingSum/ratingCount on User when that's slow.
  async driverRating(driverId: string) {
    const ratings = await this.prisma.rating.findMany({ where: { driverId }, select: { stars: true } });
    const { average, count } = summarizeRatings(ratings.map((r) => r.stars));
    return { average, count };
  }

  // Admin only (the controller arrives with the admin API). OPEN → RESOLVED | DISMISSED, once.
  async resolveComplaint(
    adminId: string,
    complaintId: string,
    status: 'RESOLVED' | 'DISMISSED',
    resolutionNote: string,
  ) {
    // Conditional update: two admins deciding at once both run this; the second matches 0 rows.
    const { count } = await this.prisma.complaint.updateMany({
      where: { id: complaintId, status: 'OPEN' },
      data: { status, resolutionNote, resolvedById: adminId, resolvedAt: new Date() },
    });
    if (count !== 1) {
      const exists = await this.prisma.complaint.findUnique({ where: { id: complaintId }, select: { id: true } });
      if (!exists) throw new NotFoundException('Complaint not found');
      throw new DomainException('INVALID_TRANSITION', HttpStatus.CONFLICT, 'This complaint was already decided');
    }
    return this.prisma.complaint.findUniqueOrThrow({
      where: { id: complaintId },
      select: { ...DRIVER_COMPLAINT_FIELDS, resolvedBy: { select: { name: true } } },
    });
  }

  // Same gate as payment (docs/ARCHITECTURE.md §4.5): the caller's own, active booking on a
  // COMPLETED trip. No lock or transaction: COMPLETED is terminal, and a booking can't be
  // cancelled after its trip started, so nothing checked here can change before the insert.
  private async driverOfCompletedTrip(passengerId: string, membershipId: string) {
    const membership = await this.prisma.poolMembership.findUnique({
      where: { id: membershipId },
      select: {
        passengerId: true,
        cancelledAt: true,
        pool: { select: { status: true, vehicle: { select: { driverId: true } } } },
      },
    });
    if (!membership) throw new NotFoundException('Booking not found');
    if (membership.passengerId !== passengerId) {
      throw new ForbiddenException('This booking is not yours');
    }
    if (membership.pool.status !== 'COMPLETED' || membership.cancelledAt) {
      throw new DomainException(
        'FEEDBACK_NOT_ALLOWED',
        HttpStatus.CONFLICT,
        'You can only rate or report a completed trip you were on',
      );
    }
    // From the pool, never from the request body: you can only rate the driver you rode with.
    return membership.pool.vehicle.driverId;
  }
}
