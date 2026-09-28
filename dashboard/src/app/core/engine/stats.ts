/** Port of src/metrics/winrate.wilson_ci; checked against the Python reference values in tools/verify-engine-parity.mjs. */

// Two-sided critical value for alpha = 0.05 (statistics.NormalDist().inv_cdf(0.975)).
export const Z_95 = 1.9599639845400534;

export interface WilsonInterval {
  wins: number;
  n: number;
  pHat: number;
  lower: number;
  upper: number;
}

export function wilsonCi(wins: number, n: number, z: number = Z_95): WilsonInterval {
  if (n <= 0) throw new Error('n must be positive');
  if (wins < 0 || wins > n) throw new Error('wins must be between 0 and n');
  const pHat = wins / n;
  const denom = 1 + (z * z) / n;
  const center = (pHat + (z * z) / (2 * n)) / denom;
  const halfWidth = (z / denom) * Math.sqrt((pHat * (1 - pHat)) / n + (z * z) / (4 * n * n));
  return { wins, n, pHat, lower: Math.max(0, center - halfWidth), upper: Math.min(1, center + halfWidth) };
}

/** Two-proportion z statistic (pooled), used to compare sandbox vs research win rates. */
export function twoProportionZ(wins1: number, n1: number, wins2: number, n2: number): number {
  const p1 = wins1 / n1;
  const p2 = wins2 / n2;
  const pooled = (wins1 + wins2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  return se === 0 ? 0 : (p1 - p2) / se;
}
