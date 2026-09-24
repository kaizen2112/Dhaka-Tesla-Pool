import { Injectable } from '@nestjs/common';
import { DHAKA_ZONES, ROADS } from './locations';

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Haversine: the straight line between two zone centres. Used only for the length of one road.
export function straightLineKm(zoneA: string, zoneB: string): number {
  const a = DHAKA_ZONES[zoneA];
  const b = DHAKA_ZONES[zoneB];
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(h));
}

// Pure — no DB, no side effects. Distance = the shortest path along ROADS, the same distance
// fares and matching use and the map draws (docs/ARCHITECTURE.md §5). Isolated on purpose:
// swapping in a real routing API later changes only this class.
@Injectable()
export class LocationService {
  // All-pairs shortest paths, computed once. Floyd–Warshall: 9 zones → 729 steps.
  // ponytail: O(n³) at startup; fine for a fixed zone list, Dijkstra per query if it grows.
  private readonly km: Record<string, Record<string, number>> = {};
  private readonly nextHop: Record<string, Record<string, string>> = {};

  constructor() {
    const zones = Object.keys(DHAKA_ZONES);
    for (const a of zones) {
      this.km[a] = {};
      this.nextHop[a] = {};
      for (const b of zones) this.km[a][b] = a === b ? 0 : Infinity;
      this.nextHop[a][a] = a;
    }
    for (const [a, b] of ROADS) {
      this.km[a][b] = this.km[b][a] = straightLineKm(a, b);
      this.nextHop[a][b] = b;
      this.nextHop[b][a] = a;
    }
    for (const via of zones) {
      for (const a of zones) {
        for (const b of zones) {
          if (this.km[a][via] + this.km[via][b] < this.km[a][b]) {
            this.km[a][b] = this.km[a][via] + this.km[via][b];
            this.nextHop[a][b] = this.nextHop[a][via];
          }
        }
      }
    }
    // A zone no road reaches would price at Infinity; fail at startup instead.
    for (const a of zones) {
      for (const b of zones) {
        if (this.km[a][b] === Infinity) throw new Error(`No road route from ${a} to ${b}`);
      }
    }
  }

  getDistanceKm(zoneA: string, zoneB: string): number {
    this.assertZones(zoneA, zoneB);
    return this.km[zoneA][zoneB];
  }

  // The zones a trip passes through, both ends included (e.g. Dhanmondi → Farmgate →
  // Mohakhali → Gulshan 1).
  getRoute(zoneA: string, zoneB: string): string[] {
    this.assertZones(zoneA, zoneB);
    const route = [zoneA];
    for (let at = zoneA; at !== zoneB; ) {
      at = this.nextHop[at][zoneB];
      route.push(at);
    }
    return route;
  }

  private assertZones(zoneA: string, zoneB: string) {
    if (!DHAKA_ZONES[zoneA] || !DHAKA_ZONES[zoneB]) {
      throw new Error(`Unknown zone code: ${!DHAKA_ZONES[zoneA] ? zoneA : zoneB}`);
    }
  }
}
