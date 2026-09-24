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

// A rider with an id, so a route plan can say who boards / leaves at each stop.
export interface RouteRider extends RiderTrip {
  id: string;
}

export interface RouteStop {
  order: number; // 1-based
  zone: string;
  type: 'PICKUP' | 'DROPOFF';
  riderIds: string[];
}

export interface RoutePlan {
  stops: RouteStop[];
  extraKm: Record<string, number>; // rider id → km ridden beyond their direct trip
}

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

    const riders = [...pool.members, request];
    const best = this.bestDropOffOrder(pool.pickupZone, riders);
    if (best.maxExtraKm > MAX_EXTRA_KM) {
      return { matched: false, reason: 'EXTRA_DISTANCE_TOO_HIGH', maxExtraKm: best.maxExtraKm };
    }

    return {
      matched: true,
      score: pickupDistanceKm + best.maxExtraKm,
      maxExtraKm: best.maxExtraKm,
      dropOffOrder: best.order.map((i) => riders[i].destinationZone),
    };
  }

  // The route the pool's riders take, for display (the map, the driver's stop list): the same
  // stops and drop-off order canJoinPool judged the pool by, plus each rider's extra km.
  planRoute(anchorPickup: string, riders: RouteRider[]): RoutePlan {
    const best = this.bestDropOffOrder(anchorPickup, riders);
    const raw: Omit<RouteStop, 'order'>[] = [
      // Empty unless it merges with the first pickup: the anchor rider may have cancelled.
      { zone: anchorPickup, type: 'PICKUP', riderIds: [] },
      ...riders.map((r) => ({ zone: r.pickupZone, type: 'PICKUP' as const, riderIds: [r.id] })),
      ...best.order.map((i) => ({
        zone: riders[i].destinationZone,
        type: 'DROPOFF' as const,
        riderIds: [riders[i].id],
      })),
    ];

    // Back-to-back stops in the same zone are one stop (everyone boarding at Banani).
    const stops: RouteStop[] = [];
    for (const stop of raw) {
      const last = stops.at(-1);
      if (last && last.zone === stop.zone && last.type === stop.type) {
        last.riderIds.push(...stop.riderIds);
      } else {
        stops.push({ order: stops.length + 1, ...stop, riderIds: [...stop.riderIds] });
      }
    }

    return {
      stops,
      extraKm: Object.fromEntries(riders.map((r, i) => [r.id, best.extrasKm[i]])),
    };
  }

  // Tries every drop-off order and keeps the one with the smallest worst extra, so the
  // result doesn't depend on who booked first. At most capacity! orders (3! = 6 for Bullet).
  // ponytail: brute force is O(n!); fine up to the 7-seat cap, needs a heuristic beyond that.
  // Returns rider indexes in drop-off order, and each rider's extra km (in rider order).
  private bestDropOffOrder(anchorPickup: string, riders: RiderTrip[]) {
    let best = { maxExtraKm: Infinity, order: [] as number[], extrasKm: [] as number[] };
    for (const order of permutations(riders.map((_, i) => i))) {
      const extrasKm = this.extrasKm(anchorPickup, riders, order);
      const worst = Math.max(0, ...extrasKm);
      if (worst < best.maxExtraKm) best = { maxExtraKm: worst, order, extrasKm };
    }
    return best;
  }

  // Route: anchor pickup → each rider's pickup in join order → drop-offs in `order`.
  // A rider's extra = km actually ridden (their pickup → their drop-off) − their direct km.
  private extrasKm(anchorPickup: string, riders: RiderTrip[], order: number[]): number[] {
    const stops = [
      anchorPickup,
      ...riders.map((r) => r.pickupZone),
      ...order.map((i) => riders[i].destinationZone),
    ];
    const cumulativeKm = [0];
    for (let s = 1; s < stops.length; s++) {
      cumulativeKm.push(cumulativeKm[s - 1] + this.location.getDistanceKm(stops[s - 1], stops[s]));
    }

    return riders.map((rider, i) => {
      const boardStop = 1 + i;
      const dropStop = 1 + riders.length + order.indexOf(i);
      const riddenKm = cumulativeKm[dropStop] - cumulativeKm[boardStop];
      const directKm = this.location.getDistanceKm(rider.pickupZone, rider.destinationZone);
      // Never below 0 (a direct trip can come out a hair negative in floating point).
      return Math.max(0, riddenKm - directKm);
    });
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
