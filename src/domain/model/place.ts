import type { Coordinates } from "./geo.js";

export const BUSINESS_STATUSES = [
  "OPERATIONAL",
  "CLOSED_TEMPORARILY",
  "CLOSED_PERMANENTLY",
  "FUTURE_OPENING",
  "UNKNOWN",
] as const;

export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

/**
 * One place as discovery returns it. Every field here is available inside the
 * Enterprise-tier field mask; nothing on this type requires an Atmosphere field.
 */
export interface Place {
  readonly placeId: string;
  readonly displayName: string;
  readonly formattedAddress: string | null;
  readonly nationalPhoneNumber: string | null;
  readonly primaryType: string | null;
  readonly types: readonly string[];
  readonly businessStatus: BusinessStatus;
  readonly rating: number | null;
  readonly userRatingCount: number;
  /** Null means Google returned no website for this place. */
  readonly websiteUri: string | null;
  /** A business that visits customers rather than receiving them. */
  readonly pureServiceArea: boolean;
  /**
   * Null for pure service-area businesses: Google omits location fields for
   * them, and those are exactly the trades the second discovery pass targets.
   * The nullability is load-bearing, not defensive.
   */
  readonly coordinates: Coordinates | null;
  /** Present when Google recognizes the place as part of a brand. */
  readonly brandId: string | null;
}
