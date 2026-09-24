import { ROADS } from './locations';
import { LocationService, straightLineKm } from './location.service';

// Reference distances, docs/ARCHITECTURE.md §5 (shortest road path, 3 dp).
const REFERENCE_DISTANCES_KM: [string, string, number][] = [
  ['BANANI', 'MOHAKHALI', 1.972],
  ['BANANI', 'GULSHAN_1', 1.794],
  ['BANANI', 'FARMGATE', 4.348], // via Mohakhali
  ['BANANI', 'DHANMONDI', 6.393], // via Mohakhali, Farmgate
  ['BANANI', 'UTTARA', 9.547],
  ['MOHAKHALI', 'GULSHAN_1', 1.81],
  ['MOHAKHALI', 'FARMGATE', 2.377],
  ['DHANMONDI', 'GULSHAN_1', 6.232], // via Farmgate, Mohakhali
];

describe('LocationService', () => {
  const service = new LocationService();

  it.each(REFERENCE_DISTANCES_KM)(
    'getDistanceKm(%s, %s) ≈ %skm',
    (a, b, expectedKm) => {
      expect(service.getDistanceKm(a, b)).toBeCloseTo(expectedKm, 3);
    },
  );

  it('follows the roads: Dhanmondi → Gulshan 1 goes through Farmgate and Mohakhali', () => {
    expect(service.getRoute('DHANMONDI', 'GULSHAN_1')).toEqual([
      'DHANMONDI',
      'FARMGATE',
      'MOHAKHALI',
      'GULSHAN_1',
    ]);
  });

  it('a direct road is just its two ends, and its length is the straight line', () => {
    expect(service.getRoute('BANANI', 'MOHAKHALI')).toEqual(['BANANI', 'MOHAKHALI']);
    for (const [a, b] of ROADS) {
      expect(service.getDistanceKm(a, b)).toBeCloseTo(straightLineKm(a, b), 10);
    }
  });

  it('is never shorter than the straight line', () => {
    expect(service.getDistanceKm('DHANMONDI', 'GULSHAN_1')).toBeGreaterThan(
      straightLineKm('DHANMONDI', 'GULSHAN_1'),
    );
  });

  it('is symmetric', () => {
    expect(service.getDistanceKm('BANANI', 'UTTARA')).toBeCloseTo(
      service.getDistanceKm('UTTARA', 'BANANI'),
      10,
    );
  });

  it('is zero for the same zone', () => {
    expect(service.getDistanceKm('BANANI', 'BANANI')).toBe(0);
    expect(service.getRoute('BANANI', 'BANANI')).toEqual(['BANANI']);
  });

  it('throws for an unknown zone code', () => {
    expect(() => service.getDistanceKm('BANANI', 'NOWHERE')).toThrow();
  });
});
