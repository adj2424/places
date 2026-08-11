export interface ScoreFactor {
  readonly name: string;
  readonly points: number;
}

/**
 * Every weight that fired, plus the total they produce. Persisted per lead so a
 * score can be explained after the fact and refit once real outcomes exist.
 */
export interface ScoreBreakdown {
  readonly factors: readonly ScoreFactor[];
  readonly total: number;
}

export function sumFactors(factors: readonly ScoreFactor[]): number {
  return factors.reduce((running, factor) => running + factor.points, 0);
}
