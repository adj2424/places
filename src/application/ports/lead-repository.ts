import type { QueryCircle } from "../../domain/model/geo.js";
import type { Lead, StoredLead } from "../../domain/model/lead.js";
import type { ExclusionReason } from "../../domain/model/segment.js";

export interface NormalizedNameCount {
  readonly normalizedName: string;
  readonly distinctLocations: number;
}

export interface LeadRepository {
  /**
   * Writes Google-sourced and derived columns only. Operator columns and the
   * contact-time snapshot are never touched, which is what lets a re-sweep run
   * without destroying the outcome data the score will later be refit against.
   */
  upsertMany(leads: readonly Lead[]): Promise<void>;

  /**
   * Counts across the entire persisted corpus, not just the current sweep — a
   * chain whose locations were found in separate sweeps is only detectable here.
   */
  countNormalizedNames(): Promise<readonly NormalizedNameCount[]>;

  /** Leads whose website evidence is older than the verification window. */
  findStaleVerifications(
    verifiedBefore: Date,
    limit: number,
  ): Promise<readonly StoredLead[]>;

  /** Qualified leads inside the circle, ordered by score descending. */
  findQualifiedWithin(
    circle: QueryCircle,
    limit: number,
  ): Promise<readonly StoredLead[]>;

  /**
   * Applies a retroactive exclusion without deleting the row or writing to any
   * operator column, so notes on an already-contacted lead survive.
   */
  excludeByPlaceId(
    placeIds: readonly string[],
    reason: ExclusionReason,
  ): Promise<void>;
}
