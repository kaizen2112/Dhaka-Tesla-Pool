import { Injectable } from '@nestjs/common';
import { DHAKA_ZONES } from './locations';

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Pure — no DB, no side effects. Straight-line distance, not road distance
// (docs/ARCHITECTURE.md §5 / brief §4: no real routing required).
@Injectable()
export class LocationService {
  getDistanceKm(zoneA: string, zoneB: string): number {
    const a = DHAKA_ZONES[zoneA];
    const b = DHAKA_ZONES[zoneB];
    if (!a || !b) {
      throw new Error(`Unknown zone code: ${!a ? zoneA : zoneB}`);
    }

    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.asin(Math.sqrt(h));

    return EARTH_RADIUS_KM * c;
  }
}
