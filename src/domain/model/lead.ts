import type { Place } from "./place.js";
import type { ScoreBreakdown } from "./score-breakdown.js";
import type { ExclusionReason, QualifyingSegment } from "./segment.js";

/** Whether a returned lead earned its slot by score or by the random draw. */
export type SelectionSource = "rank" | "draw";

/**
 * What the probe found, independent of what it means. `transport_failure` is
 * the marker for an unverified place and is never treated as a dead site.
 */
export const WEBSITE_STATUSES = [
  "none_listed",
  "aggregator",
  "unresolvable",
  "parked",
  "stub",
  "live",
  "transport_failure",
] as const;

export type WebsiteStatus = (typeof WEBSITE_STATUSES)[number];

/**
 * The scoring inputs as they stood when the operator first recorded contact.
 * Written once and never rewritten, so an outcome logged in March stays
 * attached to March's features even after a May re-sweep changes them.
 */
export interface ContactSnapshot {
  readonly score: number;
  readonly breakdown: ScoreBreakdown;
  readonly userRatingCount: number;
  readonly rating: number | null;
  readonly segment: QualifyingSegment;
  readonly takenAt: string;
}

/** Operator-owned columns. The sweep reads these and never writes them. */
export interface OperatorFields {
  readonly contactStatus: string | null;
  readonly contactedAt: string | null;
  readonly notes: string | null;
}

/**
 * One evaluated place. A null `segment` means the place is not a contactable
 * lead — it was excluded, unverified, or has a working site — which makes
 * `segment is not null` the qualified-lead predicate.
 */
export interface Lead {
  readonly place: Place;
  readonly segment: QualifyingSegment | null;
  readonly exclusionReason: ExclusionReason | null;
  readonly websiteStatus: WebsiteStatus;
  readonly email: string | null;
  readonly score: number | null;
  readonly breakdown: ScoreBreakdown | null;
  readonly selectionSource: SelectionSource | null;
  readonly verifiedAt: string;
}

/** A persisted lead, including the columns this service does not author. */
export interface StoredLead extends Lead {
  readonly operator: OperatorFields;
  readonly contactSnapshot: ContactSnapshot | null;
}

export function isQualified(lead: Lead): boolean {
  return lead.segment !== null;
}
