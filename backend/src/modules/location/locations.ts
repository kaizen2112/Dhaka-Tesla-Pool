// Predefined Dhaka zones with plain lat/lng — no map API (docs/ARCHITECTURE.md §5, brief §4).
export interface Zone {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export const DHAKA_ZONES: Record<string, Zone> = {
  FARMGATE: { code: 'FARMGATE', name: 'Farmgate', lat: 23.7578, lng: 90.3897 },
  MOHAKHALI: { code: 'MOHAKHALI', name: 'Mohakhali', lat: 23.7772, lng: 90.3995 },
  BANANI: { code: 'BANANI', name: 'Banani', lat: 23.7937, lng: 90.4066 },
  GULSHAN_1: { code: 'GULSHAN_1', name: 'Gulshan 1', lat: 23.7806, lng: 90.4169 },
  GULSHAN_2: { code: 'GULSHAN_2', name: 'Gulshan 2', lat: 23.7925, lng: 90.4172 },
  DHANMONDI: { code: 'DHANMONDI', name: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
  MIRPUR_10: { code: 'MIRPUR_10', name: 'Mirpur 10', lat: 23.8069, lng: 90.3687 },
  UTTARA: { code: 'UTTARA', name: 'Uttara', lat: 23.8759, lng: 90.3795 },
  BASHUNDHARA: { code: 'BASHUNDHARA', name: 'Bashundhara', lat: 23.8153, lng: 90.4256 },
};
