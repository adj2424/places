/**
 * Text Search queries issued per cell for trades that visit customers rather
 * than receiving them. Nearby Search has no service-area parameter, so these
 * terms are the only way to surface the plumber / electrician / cleaner set.
 */
export const SERVICE_AREA_TERMS: readonly string[] = [
  "plumber",
  "electrician",
  "HVAC",
  "cleaning service",
  "landscaper",
  "mobile groomer",
  "handyman",
  "pest control",
];

/** Text Search pages followed per term before stopping. */
export const TEXT_SEARCH_PAGE_CAP = 3;
