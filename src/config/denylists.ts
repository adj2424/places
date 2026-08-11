/**
 * Open-ended lists that will drift, kept as data rather than logic so they can
 * be extended without touching a decision function.
 */

/**
 * Hosts that are a social profile or link-in-bio page rather than a website.
 * A business whose Google listing points here has told Google "this is my
 * website" and it is not one, which is the highest-intent signal in the set.
 */
export const AGGREGATOR_HOSTS: readonly string[] = [
  "facebook.com",
  "fb.com",
  "fb.me",
  "instagram.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "pinterest.com",
  "youtube.com",
  "linkedin.com",
  "tumblr.com",
  "nextdoor.com",
  "yelp.com",
  "linktr.ee",
  "linktree.com",
  "beacons.ai",
  "lnk.bio",
  "linkin.bio",
  "taplink.cc",
  "solo.to",
  "bio.link",
  "square.site",
  "etsy.com",
  "wixsite.com",
  "godaddysites.com",
  "sites.google.com",
  // Google Business Profile's free sites, shut down in 2024. A surviving URL is
  // a guaranteed 404 and therefore a perfect "needs a website" signal.
  "business.site",
  "negocio.site",
  "order.online",
];

/**
 * Google place types that are not businesses or organizations. Discovery asks
 * for everything, because the generic "establishment" type cannot be used as a
 * request filter, so the tail gets removed here instead.
 */
export const NON_BUSINESS_TYPES: readonly string[] = [
  "bus_stop",
  "bus_station",
  "transit_station",
  "transit_depot",
  "subway_station",
  "train_station",
  "light_rail_station",
  "taxi_stand",
  "parking",
  "rest_stop",
  "toll_booth",
  "atm",
  "ev_charging_station",
  "airport",
  "heliport",
  "natural_feature",
  "park",
  "cemetery",
  "locality",
  "sublocality",
  "neighborhood",
  "political",
  "route",
  "street_address",
  "premise",
  "subpremise",
  "postal_code",
  "intersection",
  "plus_code",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "country",
];

/**
 * Parent-organization detection for the exclusion rule.
 *
 * The Places API exposes no denomination or parent-organization field — a
 * Catholic parish and a Baptist congregation both return `church` and
 * `place_of_worship` — so this is a name-and-host heuristic and nothing more.
 * It will miss parishes named without any of these words, and it will
 * occasionally over-match. Treating it as data is what makes it correctable.
 */
export const PARENT_SUPPLIED_NAME_PATTERNS: readonly RegExp[] = [
  /\bcatholic\b/i,
  /\bparish\b/i,
  /\barch?diocese\b/i,
  /\bdiocesan\b/i,
];

/** Hosts belonging to diocesan or parish-CMS providers. */
export const PARENT_SUPPLIED_HOSTS: readonly string[] = [
  "ecatholic.com",
  "parishesonline.com",
  "catholicweb.com",
  "diocesan.com",
  "discovermass.com",
];
