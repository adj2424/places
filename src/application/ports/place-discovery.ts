import type { QueryCircle } from "../../domain/model/geo.js";
import type { Place } from "../../domain/model/place.js";

export type DiscoveryPassKind = "nearby" | "text";

/**
 * One individual query's result count, kept separate from every other query's.
 */
export interface DiscoveryPassResult {
  readonly kind: DiscoveryPassKind;
  /** The service-area term for a text pass; null for the nearby pass. */
  readonly query: string | null;
  readonly resultCount: number;
  /** That endpoint's own per-request cap, for the saturation comparison. */
  readonly perRequestMaximum: number;
  readonly requestsIssued: number;
}

/**
 * The result of discovering one cell.
 *
 * `passes` is deliberately a list and never a sum. Saturation is judged per
 * pass against that endpoint's cap: a merged count of exactly the maximum would
 * subdivide a complete cell, and a merged count above it would accept a
 * truncated one as complete. There is intentionally no total-count field here.
 */
export interface DiscoveryResult {
  /** Deduplicated union across every pass, keyed on place ID. */
  readonly places: readonly Place[];
  readonly passes: readonly DiscoveryPassResult[];
}

export interface PlaceDiscovery {
  discover(circle: QueryCircle): Promise<DiscoveryResult>;
}
