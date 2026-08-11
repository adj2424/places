import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LeadRepository,
  NormalizedNameCount,
} from "../../../application/ports/lead-repository.js";
import type { QueryCircle } from "../../../domain/model/geo.js";
import type {
  Lead,
  StoredLead,
  WebsiteStatus,
} from "../../../domain/model/lead.js";
import type { Place } from "../../../domain/model/place.js";
import type { ScoreBreakdown } from "../../../domain/model/score-breakdown.js";
import type {
  ExclusionReason,
  QualifyingSegment,
} from "../../../domain/model/segment.js";
import { BUSINESS_STATUSES } from "../../../domain/model/place.js";
import { RepositoryError } from "./client.js";

type Supabase = SupabaseClient;

interface LeadRow {
  place_id: string;
  display_name: string;
  formatted_address: string | null;
  national_phone_number: string | null;
  primary_type: string | null;
  types: string[];
  business_status: string;
  rating: number | null;
  user_rating_count: number;
  website_uri: string | null;
  pure_service_area: boolean;
  brand_id: string | null;
  location: unknown;
  lon: number | null;
  lat: number | null;
  segment: string | null;
  exclusion_reason: string | null;
  website_status: string;
  email: string | null;
  score: number | null;
  score_breakdown: ScoreBreakdown | null;
  selection_source: "rank" | "draw" | null;
  verified_at: string;
  contact_status: string | null;
  contacted_at: string | null;
  notes: string | null;
  contact_snapshot_score: number | null;
  contact_snapshot_breakdown: ScoreBreakdown | null;
  contact_snapshot_user_rating_count: number | null;
  contact_snapshot_rating: number | null;
  contact_snapshot_segment: string | null;
  contact_snapshot_taken_at: string | null;
}

function toUpsertRow(lead: Lead): Record<string, unknown> {
  const { place } = lead;
  return {
    place_id: place.placeId,
    display_name: place.displayName,
    formatted_address: place.formattedAddress,
    national_phone_number: place.nationalPhoneNumber,
    primary_type: place.primaryType,
    types: [...place.types],
    business_status: place.businessStatus,
    rating: place.rating,
    user_rating_count: place.userRatingCount,
    website_uri: place.websiteUri,
    pure_service_area: place.pureServiceArea,
    brand_id: place.brandId,
    // WKT in EPSG:4326; a DB trigger/cast path is avoided by using ST via RPC
    // when coordinates exist. Stored as lon/lat columns for the upsert payload
    // and converted in SQL below through a dedicated RPC.
    lon: place.coordinates?.longitude ?? null,
    lat: place.coordinates?.latitude ?? null,
    segment: lead.segment,
    exclusion_reason: lead.exclusionReason,
    website_status: lead.websiteStatus,
    email: lead.email,
    score: lead.score,
    score_breakdown: lead.breakdown,
    selection_source: lead.selectionSource,
    verified_at: lead.verifiedAt,
  };
}

function rowToStoredLead(row: LeadRow): StoredLead {
  const status = BUSINESS_STATUSES.includes(
    row.business_status as (typeof BUSINESS_STATUSES)[number],
  )
    ? (row.business_status as Place["businessStatus"])
    : "UNKNOWN";

  const place: Place = {
    placeId: row.place_id,
    displayName: row.display_name,
    formattedAddress: row.formatted_address,
    nationalPhoneNumber: row.national_phone_number,
    primaryType: row.primary_type,
    types: row.types ?? [],
    businessStatus: status,
    rating: row.rating,
    userRatingCount: row.user_rating_count,
    websiteUri: row.website_uri,
    pureServiceArea: row.pure_service_area,
    brandId: row.brand_id,
    coordinates:
      row.lon === null || row.lat === null
        ? null
        : { latitude: row.lat, longitude: row.lon },
  };

  return {
    place,
    segment: row.segment as QualifyingSegment | null,
    exclusionReason: row.exclusion_reason as ExclusionReason | null,
    websiteStatus: row.website_status as WebsiteStatus,
    email: row.email,
    score: row.score,
    breakdown: row.score_breakdown,
    selectionSource: row.selection_source,
    verifiedAt: row.verified_at,
    operator: {
      contactStatus: row.contact_status,
      contactedAt: row.contacted_at,
      notes: row.notes,
    },
    contactSnapshot:
      row.contact_snapshot_taken_at === null ||
      row.contact_snapshot_score === null ||
      row.contact_snapshot_segment === null
        ? null
        : {
            score: row.contact_snapshot_score,
            breakdown: row.contact_snapshot_breakdown ?? { factors: [], total: 0 },
            userRatingCount: row.contact_snapshot_user_rating_count ?? 0,
            rating: row.contact_snapshot_rating,
            segment: row.contact_snapshot_segment as QualifyingSegment,
            takenAt: row.contact_snapshot_taken_at,
          },
  };
}

export class SupabaseLeadRepository implements LeadRepository {
  readonly #client: Supabase;

  constructor(client: Supabase) {
    this.#client = client;
  }

  async upsertMany(leads: readonly Lead[]): Promise<void> {
    if (leads.length === 0) return;

    const payload = leads.map(toUpsertRow);
    const { error } = await this.#client.rpc("upsert_leads_batch", {
      rows: payload,
    });

    if (error) {
      throw new RepositoryError(`Lead upsert failed: ${error.message}`, {
        cause: error,
      });
    }
  }

  async countNormalizedNames(): Promise<readonly NormalizedNameCount[]> {
    const { data, error } = await this.#client.rpc("count_normalized_names");
    if (error) {
      throw new RepositoryError(
        `Normalized-name read failed: ${error.message}`,
        { cause: error },
      );
    }

    return ((data as { normalized_name: string; distinct_locations: number }[]) ??
      []).map((row) => ({
      normalizedName: row.normalized_name,
      distinctLocations: row.distinct_locations,
    }));
  }

  async findStaleVerifications(
    verifiedBefore: Date,
    limit: number,
  ): Promise<readonly StoredLead[]> {
    const { data, error } = await this.#client.rpc("find_stale_verifications", {
      verified_before: verifiedBefore.toISOString(),
      row_limit: limit,
    });

    if (error) {
      throw new RepositoryError(
        `Stale-verification read failed: ${error.message}`,
        { cause: error },
      );
    }

    return ((data as LeadRow[]) ?? []).map(rowToStoredLead);
  }

  async findQualifiedWithin(
    circle: QueryCircle,
    limit: number,
  ): Promise<readonly StoredLead[]> {
    const { data, error } = await this.#client.rpc("find_qualified_within", {
      lon: circle.center.longitude,
      lat: circle.center.latitude,
      radius_meters: circle.radiusMeters,
      row_limit: limit,
    });

    if (error) {
      throw new RepositoryError(
        `Qualified-within read failed: ${error.message}`,
        { cause: error },
      );
    }

    return ((data as LeadRow[]) ?? []).map(rowToStoredLead);
  }

  async excludeByPlaceId(
    placeIds: readonly string[],
    reason: ExclusionReason,
  ): Promise<void> {
    if (placeIds.length === 0) return;

    const { error } = await this.#client
      .from("leads")
      .update({
        exclusion_reason: reason,
        segment: null,
        score: null,
        score_breakdown: null,
        selection_source: null,
      })
      .in("place_id", [...placeIds]);

    if (error) {
      throw new RepositoryError(`Retroactive exclusion failed: ${error.message}`, {
        cause: error,
      });
    }
  }
}
