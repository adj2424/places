/**
 * The scoring weight table.
 *
 * Every number here is a hypothesis. There is no conversion history to fit
 * them against yet, so their job is to order the call list well enough to start
 * generating outcome data — not to be correct. Each entry records whether its
 * direction is evidence-grounded or a judgment call, and the magnitudes are all
 * judgment. Refit them once roughly two hundred contacts have been logged.
 *
 * The weights live in this table rather than inside the scoring functions so a
 * different table can be substituted without touching the scoring code.
 */

export interface ReviewCountBand {
  /** Inclusive lower bound. Bands are evaluated highest-minimum first. */
  readonly minimum: number;
  readonly points: number;
}

export interface ScoreWeights {
  readonly base: number;
  readonly reviewCountBands: readonly ReviewCountBand[];
  readonly ratingGood: {
    readonly minRating: number;
    readonly minReviews: number;
    readonly points: number;
  };
  readonly ratingPoor: {
    readonly belowRating: number;
    readonly points: number;
  };
  readonly registeredButDeadDomain: number;
  /**
   * Deliberately zero, and deliberately present rather than omitted.
   *
   * Practitioner convention scores an active social presence up, on the theory
   * that the owner cares about marketing. Survey data points the other way: 35%
   * of businesses without a website name traffic from social and marketplaces as
   * the specific reason they do not plan to launch one, which makes a thriving
   * page a satisfied substitute rather than unmet need. The evidence is
   * directional and the sign is genuinely contested, so this is zero rather than
   * negative — and it stays in the table so the choice survives future editing.
   */
  readonly socialOnlyPresence: number;
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  // Mid-range starting point so both bonuses and penalties have room to move.
  base: 45,

  // Review count is the only revenue proxy available inside the Enterprise-tier
  // field mask: neither source exposes employee count or revenue. Direction is
  // evidence-grounded (businesses with employees are far likelier to buy than
  // sole proprietors); every threshold and magnitude below is a judgment call.
  reviewCountBands: [
    { minimum: 50, points: 15 },
    { minimum: 20, points: 10 },
    { minimum: 5, points: 3 },
    { minimum: 0, points: -10 },
  ],

  // A reputation worth displaying is a reason to want a website. Judgment.
  ratingGood: { minRating: 4.0, minReviews: 20, points: 5 },
  ratingPoor: { belowRating: 3.0, points: -5 },

  // The strongest cheap willingness-to-pay signal: only about one in five
  // businesses that intend to build a site ever buy the domain, so a registered
  // domain resolving nowhere marks an owner who already spent money and stalled.
  // Direction is evidence-informed; the magnitude is a judgment call.
  registeredButDeadDomain: 15,

  socialOnlyPresence: 0,
};
