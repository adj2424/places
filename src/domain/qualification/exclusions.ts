import {
  NON_BUSINESS_TYPES,
  PARENT_SUPPLIED_HOSTS,
  PARENT_SUPPLIED_NAME_PATTERNS,
} from "../../config/denylists.js";
import type { Place } from "../model/place.js";
import type { ExclusionReason } from "../model/segment.js";

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Suffix match, so `ns1.sedoparking.com` matches `sedoparking.com`. */
export function hostMatches(
  host: string,
  suffixes: readonly string[],
): boolean {
  const normalized = host.toLowerCase();
  return suffixes.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
  );
}

/**
 * Reasons a place cannot become a lead at all. Evaluated before any segment, so
 * an excluded place never competes for a response slot — it is removed rather
 * than scored to zero.
 */
export function findExclusion(place: Place): ExclusionReason | null {
  if (place.businessStatus === "CLOSED_PERMANENTLY") return "closed";

  // A franchisee's agreement typically forbids an independent website outright,
  // so corporate-branded locations cannot buy one even when they want to.
  if (place.brandId !== null) return "chain";

  const typeSet = new Set<string>(place.types);
  if (place.primaryType !== null) typeSet.add(place.primaryType);
  if (NON_BUSINESS_TYPES.some((type) => typeSet.has(type))) {
    return "non_business";
  }

  if (
    PARENT_SUPPLIED_NAME_PATTERNS.some((pattern) =>
      pattern.test(place.displayName),
    )
  ) {
    return "parent_supplied";
  }

  const host = place.websiteUri === null ? null : hostOf(place.websiteUri);
  if (host !== null && hostMatches(host, PARENT_SUPPLIED_HOSTS)) {
    return "parent_supplied";
  }

  return null;
}
