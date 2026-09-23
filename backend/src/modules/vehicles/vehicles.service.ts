import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { ACTIVE_POOL_STATUSES } from '../../common/ride-status';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(driverId: string, dto: CreateVehicleDto) {
    try {
      return await this.prisma.vehicle.create({
        data: { driverId, name: dto.name, capacity: dto.capacity },
      });
    } catch (error) {
      // Vehicle.driverId is unique: one Tesla per driver, enforced by the DB, not a pre-check.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainException('VEHICLE_EXISTS', HttpStatus.CONFLICT, 'You already have a vehicle');
      }
      throw error;
    }
  }

  async getMine(driverId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
      include: { pools: { where: { status: { in: ACTIVE_POOL_STATUSES } }, take: 1 } },
    });
    if (!vehicle) throw new NotFoundException('You have no vehicle yet');

    const { pools, ...rest } = vehicle;
    return { ...rest, activePool: pools[0] ?? null };
  }

  // Locks the vehicle row (docs/ARCHITECTURE.md §4.6, §8). Driver accept locks the same row
  // first, so "go offline" and "accept a request" can't interleave: either the pool exists
  // before the offline check, or the accept sees the vehicle offline.
  setStatus(driverId: string, isOnline: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const [vehicle] = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Vehicle" WHERE "driverId" = ${driverId} FOR UPDATE`;
      if (!vehicle) throw new NotFoundException('You have no vehicle yet');

      if (!isOnline) {
        const activePool = await tx.pool.findFirst({
          where: { vehicleId: vehicle.id, status: { in: ACTIVE_POOL_STATUSES } },
        });
        if (activePool) {
          throw new DomainException(
            'ACTIVE_POOL_EXISTS',
            HttpStatus.CONFLICT,
            'Finish or lose your current pool before going offline',
          );
        }
      }

      return tx.vehicle.update({ where: { id: vehicle.id }, data: { isOnline } });
    });
  }
}
