/**
 * Single Enterprise-tier field mask for every discovery request.
 *
 * `websiteUri` is Enterprise, so it sets the price floor; phone, status, rating,
 * review count, and the service-area flag are also Enterprise and therefore free
 * to add once that floor is paid. Atmosphere fields (notably `places.reviews`)
 * stay out — they would raise the bill and are the only source of per-review
 * timestamps, which is why scoring has no recency or business-age signals.
 */
export const DISCOVERY_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.primaryType",
  "places.types",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.pureServiceAreaBusiness",
  "places.location",
].join(",");

/** Atmosphere-tier fields that must never appear in the mask. */
export const ATMOSPHERE_FIELD_FRAGMENTS = [
  "places.reviews",
  "places.editorialSummary",
  "places.generativeSummary",
] as const;
