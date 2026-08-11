import type { ScoreWeights } from "../../config/score-weights.js";
import {
  sumFactors,
  type ScoreBreakdown,
  type ScoreFactor,
} from "../model/score-breakdown.js";
import type { QualifyingSegment } from "../model/segment.js";

/**
 * Every input the score is allowed to read. All of them are available inside the
 * Enterprise-tier field mask — review timestamps and business age are not, so
 * recency and tenure are deliberately absent rather than quietly approximated.
 */
export const SCORING_FIELDS = [
  "userRatingCount",
  "rating",
  "segment",
  "hasRegisteredButDeadDomain",
] as const;

export interface ScoringInput {
  readonly userRatingCount: number;
  readonly rating: number | null;
  readonly segment: QualifyingSegment;
  /** The owner bought a domain and never put a site on it. */
  readonly hasRegisteredButDeadDomain: boolean;
}

const MIN_SCORE = 0;
const MAX_SCORE = 100;

export function scoreLead(
  input: ScoringInput,
  weights: ScoreWeights,
): ScoreBreakdown {
  const factors: ScoreFactor[] = [{ name: "base", points: weights.base }];

  const band = [...weights.reviewCountBands]
    .sort((a, b) => b.minimum - a.minimum)
    .find((candidate) => input.userRatingCount >= candidate.minimum);

  if (band !== undefined) {
    factors.push({
      name: `review_count_at_least_${band.minimum}`,
      points: band.points,
    });
  }

  if (input.rating !== null) {
    if (
      input.rating >= weights.ratingGood.minRating &&
      input.userRatingCount >= weights.ratingGood.minReviews
    ) {
      factors.push({ name: "rating_good", points: weights.ratingGood.points });
    } else if (input.rating < weights.ratingPoor.belowRating) {
      factors.push({ name: "rating_poor", points: weights.ratingPoor.points });
    }
  }

  if (input.hasRegisteredButDeadDomain) {
    factors.push({
      name: "registered_but_dead_domain",
      points: weights.registeredButDeadDomain,
    });
  }

  if (input.segment === "social_only") {
    factors.push({
      name: "social_only_presence",
      points: weights.socialOnlyPresence,
    });
  }

  const raw = sumFactors(factors);
  const total = Math.min(MAX_SCORE, Math.max(MIN_SCORE, raw));

  // Keep the breakdown reconciled with the reported score, so an explanation
  // never silently disagrees with the number it explains.
  if (total !== raw) {
    factors.push({ name: "clamp", points: total - raw });
  }

  return { factors, total };
}
