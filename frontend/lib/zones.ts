// Keep in sync with the backend's DHAKA_ZONES (backend/src/modules/location/locations.ts), which
// is the source of truth: the API rejects any other code and does all distance maths. The
// coordinates are here only to draw the map (components/ride/zone-map.tsx).
export const ZONES: Record<string, { name: string; lat: number; lng: number }> = {
  BANANI: { name: "Banani", lat: 23.7937, lng: 90.4066 },
  BASHUNDHARA: { name: "Bashundhara", lat: 23.8153, lng: 90.4256 },
  DHANMONDI: { name: "Dhanmondi", lat: 23.7461, lng: 90.3742 },
  FARMGATE: { name: "Farmgate", lat: 23.7578, lng: 90.3897 },
  GULSHAN_1: { name: "Gulshan 1", lat: 23.7806, lng: 90.4169 },
  GULSHAN_2: { name: "Gulshan 2", lat: 23.7925, lng: 90.4172 },
  MIRPUR_10: { name: "Mirpur 10", lat: 23.8069, lng: 90.3687 },
  MOHAKHALI: { name: "Mohakhali", lat: 23.7772, lng: 90.3995 },
  UTTARA: { name: "Uttara", lat: 23.8759, lng: 90.3795 },
};

// Keep in sync with the backend's ROADS (backend/src/modules/location/locations.ts). The API
// prices every trip on the shortest chain of these roads; the map only draws the same path.
export const ROADS: [string, string][] = [
  ["DHANMONDI", "FARMGATE"],
  ["DHANMONDI", "MIRPUR_10"],
  ["FARMGATE", "MOHAKHALI"],
  ["FARMGATE", "MIRPUR_10"],
  ["MOHAKHALI", "BANANI"],
  ["MOHAKHALI", "GULSHAN_1"],
  ["BANANI", "GULSHAN_1"],
  ["BANANI", "GULSHAN_2"],
  ["GULSHAN_1", "GULSHAN_2"],
  ["BANANI", "MIRPUR_10"],
  ["BANANI", "UTTARA"],
  ["GULSHAN_2", "BASHUNDHARA"],
  ["BASHUNDHARA", "UTTARA"],
  ["MIRPUR_10", "UTTARA"],
];

function straightLineKm(a: string, b: string) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const [za, zb] = [ZONES[a], ZONES[b]];
  const h =
    Math.sin(rad(zb.lat - za.lat) / 2) ** 2 +
    Math.cos(rad(za.lat)) * Math.cos(rad(zb.lat)) * Math.sin(rad(zb.lng - za.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Next hop on the shortest road path between every pair (Floyd–Warshall, same as the backend's
// LocationService), built once on first use.
let nextHop: Record<string, Record<string, string>> | null = null;

function buildNextHop() {
  const codes = Object.keys(ZONES);
  const km: Record<string, Record<string, number>> = {};
  const next: Record<string, Record<string, string>> = {};
  for (const a of codes) {
    km[a] = {};
    next[a] = { [a]: a };
    for (const b of codes) km[a][b] = a === b ? 0 : Infinity;
  }
  for (const [a, b] of ROADS) {
    km[a][b] = km[b][a] = straightLineKm(a, b);
    next[a][b] = b;
    next[b][a] = a;
  }
  for (const via of codes) {
    for (const a of codes) {
      for (const b of codes) {
        if (km[a][via] + km[via][b] < km[a][b]) {
          km[a][b] = km[a][via] + km[via][b];
          next[a][b] = next[a][via];
        }
      }
    }
  }
  return next;
}

// The zones a trip passes through, both ends included: Dhanmondi → Farmgate → Mohakhali → Gulshan 1.
export function roadPath(from: string, to: string): string[] {
  nextHop ??= buildNextHop();
  const path = [from];
  for (let at = from; at !== to && nextHop[at]?.[to]; ) {
    at = nextHop[at][to];
    path.push(at);
  }
  return path;
}

export const ZONE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(ZONES).map(([code, zone]) => [code, zone.name]),
);

export function zoneName(code: string) {
  return ZONE_NAMES[code] ?? code;
}

export function route(pickupZone: string, destinationZone: string) {
  return `${zoneName(pickupZone)} → ${zoneName(destinationZone)}`;
}
