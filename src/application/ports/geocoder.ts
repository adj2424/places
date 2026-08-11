import type { Coordinates } from "../../domain/model/geo.js";

/**
 * Ambiguity is a distinct outcome, not a variant of success. Silently taking
 * the first of several candidates would sweep the wrong place and then record
 * coverage against ground the caller never asked about.
 */
export type GeocodeResult =
  | {
      readonly kind: "resolved";
      readonly coordinates: Coordinates;
      readonly formattedAddress: string;
    }
  | { readonly kind: "unresolvable" }
  | { readonly kind: "ambiguous"; readonly candidates: readonly string[] };

export interface Geocoder {
  resolve(address: string): Promise<GeocodeResult>;
}
