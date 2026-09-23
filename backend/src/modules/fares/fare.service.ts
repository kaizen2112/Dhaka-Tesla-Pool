import { Injectable } from '@nestjs/common';
import { LocationService } from '../location/location.service';
import {
  BASE_FARE_POYSHA,
  PER_KM_POYSHA,
  POOL_DISCOUNT_PERCENT,
} from './fare.constants';

export interface FareInput {
  pickupZone: string;
  destinationZone: string;
  seats: number;
  shared: boolean; // pool has ≥ 2 active memberships
}

// Totals for all `seats`, so basePoysha + distanceChargePoysha − discountPoysha = farePoysha.
export interface FareBreakdown {
  pricingKm: number;
  seats: number;
  basePoysha: number;
  distanceChargePoysha: number;
  discountPoysha: number;
  farePoysha: number;
}

// Pure — no DB. Per-passenger fare from the passenger's own trip, never a split of the pool
// total (docs/ARCHITECTURE.md §7).
@Injectable()
export class FareService {
  constructor(private readonly location: LocationService) {}

  calculate(input: FareInput): FareBreakdown {
    const distanceKm = this.location.getDistanceKm(
      input.pickupZone,
      input.destinationZone,
    );

    // Price in 0.1 km steps so fares can be checked by hand; the only intermediate rounding.
    const pricingTenths = Math.round(distanceKm * 10);
    const distanceChargePerSeat = (pricingTenths * PER_KM_POYSHA) / 10;
    const subtotalPerSeat = BASE_FARE_POYSHA + distanceChargePerSeat;
    const discountPerSeat = input.shared
      ? (subtotalPerSeat * POOL_DISCOUNT_PERCENT) / 100
      : 0;

    const farePoysha = Math.round(
      (subtotalPerSeat - discountPerSeat) * input.seats,
    );
    const basePoysha = BASE_FARE_POYSHA * input.seats;
    const distanceChargePoysha = Math.round(distanceChargePerSeat * input.seats);

    return {
      pricingKm: pricingTenths / 10,
      seats: input.seats,
      basePoysha,
      distanceChargePoysha,
      // Derived, so the breakdown always adds up exactly to the fare.
      discountPoysha: basePoysha + distanceChargePoysha - farePoysha,
      farePoysha,
    };
  }
}
