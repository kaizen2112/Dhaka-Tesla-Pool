import { LocationService } from './location.service';

// Reference distances, docs/ARCHITECTURE.md §5 (Haversine, 3 dp).
const REFERENCE_DISTANCES_KM: [string, string, number][] = [
  ['BANANI', 'MOHAKHALI', 1.972],
  ['BANANI', 'GULSHAN_1', 1.794],
  ['BANANI', 'FARMGATE', 4.347],
  ['BANANI', 'DHANMONDI', 6.236],
  ['BANANI', 'UTTARA', 9.547],
  ['MOHAKHALI', 'GULSHAN_1', 1.81],
  ['MOHAKHALI', 'FARMGATE', 2.377],
];

describe('LocationService', () => {
  const service = new LocationService();

  it.each(REFERENCE_DISTANCES_KM)(
    'getDistanceKm(%s, %s) ≈ %skm',
    (a, b, expectedKm) => {
      expect(service.getDistanceKm(a, b)).toBeCloseTo(expectedKm, 3);
    },
  );

  it('is symmetric', () => {
    expect(service.getDistanceKm('BANANI', 'UTTARA')).toBeCloseTo(
      service.getDistanceKm('UTTARA', 'BANANI'),
      10,
    );
  });

  it('is zero for the same zone', () => {
    expect(service.getDistanceKm('BANANI', 'BANANI')).toBe(0);
  });

  it('throws for an unknown zone code', () => {
    expect(() => service.getDistanceKm('BANANI', 'NOWHERE')).toThrow();
  });
});
