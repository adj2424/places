import { describe, expect, it } from "vitest";
import {
  SCORING_FIELDS,
  scoreLead,
  type ScoringInput,
} from "../../src/domain/scoring/score.js";
import {
  DEFAULT_SCORE_WEIGHTS,
  type ScoreWeights,
} from "../../src/config/score-weights.js";
import { sumFactors } from "../../src/domain/model/score-breakdown.js";

function input(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    userRatingCount: 30,
    rating: 4.2,
    segment: "no_website",
    hasRegisteredButDeadDomain: false,
    ...overrides,
  };
}

describe("scoreLead", () => {
  it("scores a well-reviewed business above a barely-reviewed one", () => {
    const busy = scoreLead(input({ userRatingCount: 120 }), DEFAULT_SCORE_WEIGHTS);
    const quiet = scoreLead(input({ userRatingCount: 6 }), DEFAULT_SCORE_WEIGHTS);

    expect(busy.total).toBeGreaterThan(quiet.total);
  });

  it("applies a penalty below the minimum review count", () => {
    const result = scoreLead(
      input({ userRatingCount: 2, rating: null }),
      DEFAULT_SCORE_WEIGHTS,
    );

    const penalty = result.factors.find((factor) => factor.points < 0);
    expect(penalty).toBeDefined();
    expect(result.total).toBeLessThan(
      scoreLead(input({ userRatingCount: 30, rating: null }), DEFAULT_SCORE_WEIGHTS)
        .total,
    );
  });

  it("scores a registered-but-dead domain above an otherwise identical lead", () => {
    const stalled = scoreLead(
      input({ hasRegisteredButDeadDomain: true }),
      DEFAULT_SCORE_WEIGHTS,
    );
    const never = scoreLead(
      input({ hasRegisteredButDeadDomain: false }),
      DEFAULT_SCORE_WEIGHTS,
    );

    expect(stalled.total).toBeGreaterThan(never.total);
  });

  it("changes the score by exactly zero for social-only presence", () => {
    const social = scoreLead(input({ segment: "social_only" }), DEFAULT_SCORE_WEIGHTS);
    const none = scoreLead(input({ segment: "no_website" }), DEFAULT_SCORE_WEIGHTS);

    expect(social.total).toBe(none.total);
  });

  it("records social-only as an explicit zero-weighted factor rather than omitting it", () => {
    const social = scoreLead(input({ segment: "social_only" }), DEFAULT_SCORE_WEIGHTS);
    const factor = social.factors.find((f) => f.name.includes("social_only"));

    expect(factor).toBeDefined();
    expect(factor?.points).toBe(0);
  });

  it("keeps the breakdown reconciled with the reported total", () => {
    for (const count of [0, 4, 12, 25, 80, 500]) {
      const result = scoreLead(input({ userRatingCount: count }), DEFAULT_SCORE_WEIGHTS);
      expect(sumFactors(result.factors)).toBeCloseTo(result.total, 9);
    }
  });

  it("clamps a runaway positive weight table to 100", () => {
    const generous: ScoreWeights = {
      ...DEFAULT_SCORE_WEIGHTS,
      base: 90,
      registeredButDeadDomain: 500,
    };

    const result = scoreLead(
      input({ hasRegisteredButDeadDomain: true }),
      generous,
    );

    expect(result.total).toBe(100);
    expect(sumFactors(result.factors)).toBeCloseTo(100, 9);
  });

  it("clamps a runaway negative weight table to 0", () => {
    const punishing: ScoreWeights = {
      ...DEFAULT_SCORE_WEIGHTS,
      base: 0,
      reviewCountBands: [{ minimum: 0, points: -500 }],
    };

    const result = scoreLead(input({ userRatingCount: 1 }), punishing);

    expect(result.total).toBe(0);
    expect(sumFactors(result.factors)).toBeCloseTo(0, 9);
  });

  it("changes the score from a substituted weight table with no code change", () => {
    const shifted: ScoreWeights = { ...DEFAULT_SCORE_WEIGHTS, base: 10 };

    expect(scoreLead(input(), shifted).total).not.toBe(
      scoreLead(input(), DEFAULT_SCORE_WEIGHTS).total,
    );
  });

  it("uses no field outside the Enterprise-tier field mask", () => {
    // Review timestamps and business age come from the Atmosphere-tier
    // `reviews` field, which the field-mask decision excludes.
    const forbidden = [
      "reviews",
      "reviewRecency",
      "latestReviewAt",
      "openingDate",
      "businessAge",
      "formationDate",
    ];

    for (const field of forbidden) {
      expect(SCORING_FIELDS as readonly string[]).not.toContain(field);
    }
    expect(SCORING_FIELDS.length).toBeGreaterThan(0);
  });

  it("treats a missing rating as neither a bonus nor a penalty", () => {
    const unrated = scoreLead(input({ rating: null }), DEFAULT_SCORE_WEIGHTS);
    const ratingFactors = unrated.factors.filter((f) => f.name.startsWith("rating"));

    expect(ratingFactors).toHaveLength(0);
  });

  it("penalises a poorly rated business", () => {
    const poor = scoreLead(input({ rating: 2.1 }), DEFAULT_SCORE_WEIGHTS);
    const good = scoreLead(input({ rating: 4.6 }), DEFAULT_SCORE_WEIGHTS);

    expect(poor.total).toBeLessThan(good.total);
  });
});
