import { LocationService } from '../location/location.service';
import { FareService } from './fare.service';

// Canonical scenario, docs/ARCHITECTURE.md §7 worked example.
describe('FareService', () => {
  const service = new FareService(new LocationService());

  it.each([
    ['Nusrat', 'MOHAKHALI', 7200],
    ['Rafiq', 'GULSHAN_1', 6880],
    ['Shirin', 'FARMGATE', 10880],
  ])('%s, Banani → %s, shared: %i poysha', (_name, destination, expected) => {
    const fare = service.calculate({
      pickupZone: 'BANANI',
      destinationZone: destination,
      seats: 1,
      shared: true,
    });
    expect(fare.farePoysha).toBe(expected);
  });

  it("Nusrat's solo estimate is 9000 poysha", () => {
    const fare = service.calculate({
      pickupZone: 'BANANI',
      destinationZone: 'MOHAKHALI',
      seats: 1,
      shared: false,
    });
    expect(fare.farePoysha).toBe(9000);
    expect(fare.discountPoysha).toBe(0);
  });

  it('breakdown matches the hand calculation and adds up', () => {
    expect(
      service.calculate({
        pickupZone: 'BANANI',
        destinationZone: 'MOHAKHALI',
        seats: 1,
        shared: true,
      }),
    ).toEqual({
      pricingKm: 2,
      seats: 1,
      basePoysha: 5000,
      distanceChargePoysha: 4000,
      discountPoysha: 1800,
      farePoysha: 7200,
    });
  });

  it('2 seats cost exactly 2 × the per-seat fare', () => {
    const oneSeat = service.calculate({
      pickupZone: 'BANANI',
      destinationZone: 'GULSHAN_1',
      seats: 1,
      shared: true,
    });
    const twoSeats = service.calculate({
      pickupZone: 'BANANI',
      destinationZone: 'GULSHAN_1',
      seats: 2,
      shared: true,
    });
    expect(twoSeats.farePoysha).toBe(2 * oneSeat.farePoysha);
    expect(
      twoSeats.basePoysha +
        twoSeats.distanceChargePoysha -
        twoSeats.discountPoysha,
    ).toBe(twoSeats.farePoysha);
  });
});
