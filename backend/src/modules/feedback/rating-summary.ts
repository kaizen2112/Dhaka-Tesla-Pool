export type StarDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

export interface RatingSummary {
  average: number | null; // 1 dp; null when nobody has rated yet (not 0, which would read as "terrible")
  count: number;
  distribution: StarDistribution;
}

// Pure, like the other deciders: a driver's stars in, the numbers the profile shows out.
export function summarizeRatings(stars: number[]): RatingSummary {
  const distribution: StarDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const s of stars) distribution[s as keyof StarDistribution] += 1;

  const count = stars.length;
  const total = stars.reduce((sum, s) => sum + s, 0);
  return {
    average: count === 0 ? null : Math.round((total / count) * 10) / 10,
    count,
    distribution,
  };
}
