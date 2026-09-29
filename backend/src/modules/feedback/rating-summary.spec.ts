import { summarizeRatings } from './rating-summary';

describe('summarizeRatings', () => {
  it('has no average until someone rates', () => {
    expect(summarizeRatings([])).toEqual({
      average: null,
      count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  it("averages Nusrat's 5 and Rafiq's 4 to 4.5", () => {
    expect(summarizeRatings([5, 4])).toMatchObject({ average: 4.5, count: 2 });
  });

  it('rounds the average to 1 decimal place', () => {
    expect(summarizeRatings([5, 4, 4]).average).toBe(4.3); // 4.333…
    expect(summarizeRatings([5, 5, 4]).average).toBe(4.7); // 4.666…
  });

  it('counts each star value', () => {
    expect(summarizeRatings([5, 5, 3, 1]).distribution).toEqual({ 1: 1, 2: 0, 3: 1, 4: 0, 5: 2 });
  });
});
