import { startOfDhakaDay } from './admin.service';

describe('startOfDhakaDay', () => {
  it('is 18:00 UTC the previous day (Dhaka is UTC+6)', () => {
    // 08:41 in Dhaka on 29 Sep = 02:41 UTC.
    expect(startOfDhakaDay(new Date('2026-09-29T02:41:00Z')).toISOString()).toBe('2026-09-28T18:00:00.000Z');
  });

  it('rolls over at Dhaka midnight, not UTC midnight', () => {
    // 23:30 UTC on 28 Sep is already 05:30 on 29 Sep in Dhaka.
    expect(startOfDhakaDay(new Date('2026-09-28T23:30:00Z')).toISOString()).toBe('2026-09-28T18:00:00.000Z');
    // 17:59 UTC is still 23:59 on 28 Sep in Dhaka.
    expect(startOfDhakaDay(new Date('2026-09-28T17:59:00Z')).toISOString()).toBe('2026-09-27T18:00:00.000Z');
  });
});
