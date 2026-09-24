import { LocationService } from '../location/location.service';
import { MatchingService, PoolSnapshot, RiderTrip } from './matching.service';

const trip = (pickupZone: string, destinationZone: string, seats = 1): RiderTrip => ({
  pickupZone,
  destinationZone,
  seats,
});

const openPool = (members: RiderTrip[]): PoolSnapshot => ({
  status: 'MATCHED',
  capacity: 3,
  occupiedSeats: members.reduce((sum, m) => sum + m.seats, 0),
  pickupZone: members[0].pickupZone,
  members,
});

const NUSRAT = trip('BANANI', 'MOHAKHALI');
const RAFIQ = trip('BANANI', 'GULSHAN_1');

describe('MatchingService', () => {
  const service = new MatchingService(new LocationService());

  it('worked example: Rafiq joins Nusrat, dropping Rafiq first (extra 1.632 km)', () => {
    const result = service.canJoinPool(RAFIQ, openPool([NUSRAT]));
    expect(result.matched).toBe(true);
    if (!result.matched) return;
    expect(result.maxExtraKm).toBeCloseTo(1.632, 2);
    expect(result.score).toBeCloseTo(1.632, 2); // same pickup, so pickup distance is 0
    expect(result.dropOffOrder).toEqual(['GULSHAN_1', 'MOHAKHALI']);
  });

  // docs/ARCHITECTURE.md §6 scenario table: [scenario, pool members, request, worst extra km, matched]
  const SCENARIOS: [string, RiderTrip[], RiderTrip, number, boolean][] = [
    ['same destination', [NUSRAT], trip('BANANI', 'MOHAKHALI'), 0.0, true],
    ['nearer destination', [trip('BANANI', 'FARMGATE')], trip('BANANI', 'MOHAKHALI'), 0.0, true],
    ['farther destination', [NUSRAT], trip('BANANI', 'FARMGATE'), 0.0, true],
    // Dhanmondi's road runs through Mohakhali, so Nusrat's drop-off is on the way.
    ['farther, same corridor', [NUSRAT], trip('BANANI', 'DHANMONDI'), 0.0, true],
    ['slightly different route (Rafiq)', [NUSRAT], RAFIQ, 1.63, true],
    ['opposite direction', [NUSRAT], trip('BANANI', 'UTTARA'), 3.94, false],
    ['third passenger Shirin', [NUSRAT, RAFIQ], trip('BANANI', 'FARMGATE'), 1.63, true],
    ['third passenger to Gulshan 2', [NUSRAT, RAFIQ], trip('BANANI', 'GULSHAN_2'), 2.25, false],
  ];

  it.each(SCENARIOS)('%s', (_name, members, request, expectedExtraKm, expectedMatch) => {
    const result = service.canJoinPool(request, openPool(members));
    expect(result.matched).toBe(expectedMatch);
    if (!result.matched) expect(result.reason).toBe('EXTRA_DISTANCE_TOO_HIGH');
    expect(result.maxExtraKm).toBeCloseTo(expectedExtraKm, 2);
  });

  it('rejects a pool that is past MATCHED', () => {
    const pool = { ...openPool([NUSRAT]), status: 'DRIVER_ARRIVED' as const };
    expect(service.canJoinPool(RAFIQ, pool)).toEqual({ matched: false, reason: 'POOL_NOT_OPEN' });
  });

  it('rejects when seats would exceed capacity', () => {
    const fullPool = openPool([NUSRAT, RAFIQ, trip('BANANI', 'FARMGATE')]);
    expect(service.canJoinPool(trip('BANANI', 'MOHAKHALI'), fullPool)).toEqual({
      matched: false,
      reason: 'CAPACITY_EXCEEDED',
    });
  });

  it('rejects a pickup more than 2 km from the anchor', () => {
    expect(service.canJoinPool(trip('UTTARA', 'BANANI'), openPool([NUSRAT]))).toEqual({
      matched: false,
      reason: 'PICKUP_TOO_FAR',
    });
  });

  it('gives the same answer whichever passenger booked first', () => {
    const rafiqJoinsNusrat = service.canJoinPool(RAFIQ, openPool([NUSRAT]));
    const nusratJoinsRafiq = service.canJoinPool(NUSRAT, openPool([RAFIQ]));
    expect(rafiqJoinsNusrat.maxExtraKm).toBeCloseTo(nusratJoinsRafiq.maxExtraKm!, 10);
  });

  describe('planRoute', () => {
    // The canonical trip (docs/DATABASE.md → Seed data): all three board at Banani.
    const riders = [
      { id: 'nusrat', ...NUSRAT },
      { id: 'rafiq', ...RAFIQ },
      { id: 'shirin', ...trip('BANANI', 'FARMGATE') },
    ];

    it('boards everyone at Banani once, then drops Rafiq, Nusrat, Shirin', () => {
      const { stops } = service.planRoute('BANANI', riders);
      expect(stops).toEqual([
        { order: 1, zone: 'BANANI', type: 'PICKUP', riderIds: ['nusrat', 'rafiq', 'shirin'] },
        { order: 2, zone: 'GULSHAN_1', type: 'DROPOFF', riderIds: ['rafiq'] },
        { order: 3, zone: 'MOHAKHALI', type: 'DROPOFF', riderIds: ['nusrat'] },
        { order: 4, zone: 'FARMGATE', type: 'DROPOFF', riderIds: ['shirin'] },
      ]);
    });

    it("reports each rider's extra km (ARCHITECTURE §6: Nusrat 1.632, Rafiq 0)", () => {
      const { extraKm } = service.planRoute('BANANI', riders);
      expect(extraKm.nusrat).toBeCloseTo(1.632, 2);
      expect(extraKm.rafiq).toBe(0);
      expect(extraKm.shirin).toBeCloseTo(1.633, 2); // 1.794 + 1.810 + 2.377 − 4.348 (road via Mohakhali)
    });

    it('uses the same drop-off order canJoinPool judged the pool by', () => {
      const joined = service.canJoinPool(riders[2], openPool([NUSRAT, RAFIQ]));
      const { stops } = service.planRoute('BANANI', riders);
      if (!joined.matched) throw new Error('Shirin should fit');
      expect(stops.filter((s) => s.type === 'DROPOFF').map((s) => s.zone)).toEqual(
        joined.dropOffOrder,
      );
    });
  });
});
