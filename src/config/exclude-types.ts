/**
 * Types omitted from Nearby Search requests so the densest non-business noise
 * never enters the response. The domain still filters NON_BUSINESS_TYPES for
 * anything that slips through; both lists live as config so they cannot drift
 * into two code paths that disagree.
 */
export const EXCLUDE_TYPES: readonly string[] = [
  "bus_stop",
  "bus_station",
  "transit_station",
  "subway_station",
  "train_station",
  "light_rail_station",
  "parking",
  "rest_stop",
  "atm",
  "ev_charging_station",
  "cemetery",
  "park",
  "natural_feature",
];
