/**
 * The four segments that make a place a contactable lead, in ladder order.
 * Classification assigns the first match, never more than one.
 */
export const QUALIFYING_SEGMENTS = [
  "no_website",
  "social_only",
  "parked_or_dead",
  "poor_website",
] as const;

export type QualifyingSegment = (typeof QUALIFYING_SEGMENTS)[number];

export const EXCLUSION_REASONS = [
  "chain",
  "closed",
  "non_business",
  "parent_supplied",
] as const;

export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

/**
 * The outcome of classifying one place.
 *
 * `unverified` is deliberately a separate variant rather than a segment value:
 * a DNS timeout or TLS error must never be reported as a dead domain, because
 * that would put working businesses at the top of the call list. It is also why
 * a persisted lead's segment stays null in this case — `segment is not null` is
 * the predicate that means "qualified lead".
 */
export type Classification =
  | { readonly kind: "qualified"; readonly segment: QualifyingSegment }
  | { readonly kind: "unverified"; readonly detail: string }
  | { readonly kind: "excluded"; readonly reason: ExclusionReason }
  | { readonly kind: "not_a_lead" };

export function isQualifyingSegment(value: string): value is QualifyingSegment {
  return (QUALIFYING_SEGMENTS as readonly string[]).includes(value);
}
