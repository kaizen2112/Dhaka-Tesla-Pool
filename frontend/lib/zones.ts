// Same codes as the backend's DHAKA_ZONES (backend/src/modules/location/locations.ts), which
// is the source of truth: the API rejects any other code. Only the display names live here.
export const ZONE_NAMES: Record<string, string> = {
  BANANI: "Banani",
  BASHUNDHARA: "Bashundhara",
  DHANMONDI: "Dhanmondi",
  FARMGATE: "Farmgate",
  GULSHAN_1: "Gulshan 1",
  GULSHAN_2: "Gulshan 2",
  MIRPUR_10: "Mirpur 10",
  MOHAKHALI: "Mohakhali",
  UTTARA: "Uttara",
};

export function zoneName(code: string) {
  return ZONE_NAMES[code] ?? code;
}

export function route(pickupZone: string, destinationZone: string) {
  return `${zoneName(pickupZone)} → ${zoneName(destinationZone)}`;
}
