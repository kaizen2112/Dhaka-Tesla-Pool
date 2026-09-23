import { Injectable } from '@nestjs/common';
import { RideStatus } from '@prisma/client';
import { LocationService } from '../location/location.service';

export const PICKUP_RADIUS_KM = 2.0;
export const MAX_EXTRA_KM = 2.0;

export interface RiderTrip {
  pickupZone: string;
  destinationZone: string;
  seats: number;
}

export interface PoolSnapshot {
  status: RideStatus;
  capacity: number;
  occupiedSeats: number;
  pickupZone: string; // anchor = first request's pickup
  members: RiderTrip[]; // active members, in join order
}

export type MatchRejection =
  | 'POOL_NOT_OPEN'
  | 'CAPACITY_EXCEEDED'
  | 'PICKUP_TOO_FAR'
  | 'EXTRA_DISTANCE_TOO_HIGH';

export type MatchResult =
  | { matched: true; score: number; maxExtraKm: number; dropOffOrder: string[] }
  | { matched: false; reason: MatchRejection; maxExtraKm?: number };

// Pure — no DB. Rule: no passenger rides more than MAX_EXTRA_KM further than they would
// alone (docs/ARCHITECTURE.md §6). RidesService ranks open pools by `score`.
@Injectable()
export class MatchingService {
  constructor(private readonly location: LocationService) {}

  canJoinPool(request: RiderTrip, pool: PoolSnapshot): MatchResult {
    if (pool.status !== 'MATCHED') {
      return { matched: false, reason: 'POOL_NOT_OPEN' };
    }
    if (pool.occupiedSeats + request.seats > pool.capacity) {
      return { matched: false, reason: 'CAPACITY_EXCEEDED' };
    }

    const pickupDistanceKm = this.location.getDistanceKm(pool.pickupZone, request.pickupZone);
    if (pickupDistanceKm > PICKUP_RADIUS_KM) {
      return { matched: false, reason: 'PICKUP_TOO_FAR' };
    }

    const best = this.bestDropOffOrder(pool.pickupZone, [...pool.members, request]);
    if (best.maxExtraKm > MAX_EXTRA_KM) {
      return { matched: false, reason: 'EXTRA_DISTANCE_TOO_HIGH', maxExtraKm: best.maxExtraKm };
    }

    return {
      matched: true,
      score: pickupDistanceKm + best.maxExtraKm,
      maxExtraKm: best.maxExtraKm,
      dropOffOrder: best.dropOffOrder,
    };
  }

  // Tries every drop-off order and keeps the one with the smallest worst extra, so the
  // result doesn't depend on who booked first. At most capacity! orders (3! = 6 for Bullet).
  // ponytail: brute force is O(n!); fine up to the 7-seat cap, needs a heuristic beyond that.
  private bestDropOffOrder(anchorPickup: string, riders: RiderTrip[]) {
    let best = { maxExtraKm: Infinity, dropOffOrder: [] as string[] };
    for (const order of permutations(riders.map((_, i) => i))) {
      const worst = this.worstExtraKm(anchorPickup, riders, order);
      if (worst < best.maxExtraKm) {
        best = { maxExtraKm: worst, dropOffOrder: order.map((i) => riders[i].destinationZone) };
      }
    }
    return best;
  }

  // Route: anchor pickup → each rider's pickup in join order → drop-offs in `order`.
  // A rider's extra = km actually ridden (their pickup → their drop-off) − their direct km.
  private worstExtraKm(anchorPickup: string, riders: RiderTrip[], order: number[]): number {
    const stops = [
      anchorPickup,
      ...riders.map((r) => r.pickupZone),
      ...order.map((i) => riders[i].destinationZone),
    ];
    const cumulativeKm = [0];
    for (let s = 1; s < stops.length; s++) {
      cumulativeKm.push(cumulativeKm[s - 1] + this.location.getDistanceKm(stops[s - 1], stops[s]));
    }

    let worst = 0;
    riders.forEach((rider, i) => {
      const boardStop = 1 + i;
      const dropStop = 1 + riders.length + order.indexOf(i);
      const riddenKm = cumulativeKm[dropStop] - cumulativeKm[boardStop];
      const directKm = this.location.getDistanceKm(rider.pickupZone, rider.destinationZone);
      worst = Math.max(worst, riddenKm - directKm);
    });
    return worst;
  }
}

function* permutations<T>(items: T[]): Generator<T[]> {
  if (items.length <= 1) {
    yield items;
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const perm of permutations(rest)) {
      yield [items[i], ...perm];
    }
  }
}
