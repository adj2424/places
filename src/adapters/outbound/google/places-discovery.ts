import { EXCLUDE_TYPES } from "../../../config/exclude-types.js";
import {
  SERVICE_AREA_TERMS,
  TEXT_SEARCH_PAGE_CAP,
} from "../../../config/service-area-terms.js";
import type {
  DiscoveryPassResult,
  DiscoveryResult,
  PlaceDiscovery,
} from "../../../application/ports/place-discovery.js";
import type { QueryCircle } from "../../../domain/model/geo.js";
import type { BusinessStatus, Place } from "../../../domain/model/place.js";
import { DISCOVERY_FIELD_MASK } from "./field-mask.js";
import {
  PlacesAdapterError,
  PlacesQuotaError,
  type GooglePlaceResource,
  type NearbySearchResponse,
  type TextSearchResponse,
} from "./types.js";

const NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const NEARBY_MAX = 20;
const TEXT_PAGE_MAX = 20;

export type FetchLike = typeof fetch;

export interface PlacesDiscoveryOptions {
  readonly apiKey: string;
  readonly fetchImpl?: FetchLike;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly maxRetries?: number;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(baseMs: number): number {
  // Avoid aligning retries on whole-second boundaries where rate windows reset.
  return baseMs + Math.floor(Math.random() * 250);
}

/**
 * Maps a Places API resource onto the domain Place. Website absence is load-
 * bearing: omitted and empty-string websiteUri both become null.
 */
export function mapGooglePlace(resource: GooglePlaceResource): Place {
  const rawId = resource.id ?? resource.name?.replace(/^places\//, "");
  if (!rawId) {
    throw new PlacesAdapterError("Place resource missing id");
  }

  const websiteRaw = resource.websiteUri;
  const websiteUri =
    websiteRaw === undefined || websiteRaw.trim() === "" ? null : websiteRaw;

  const lat = resource.location?.latitude;
  const lng = resource.location?.longitude;
  const coordinates =
    typeof lat === "number" && typeof lng === "number"
      ? { latitude: lat, longitude: lng }
      : null;

  return {
    placeId: rawId,
    displayName: resource.displayName?.text?.trim() || rawId,
    formattedAddress: resource.formattedAddress ?? null,
    nationalPhoneNumber: resource.nationalPhoneNumber ?? null,
    primaryType: resource.primaryType ?? null,
    types: resource.types ?? [],
    businessStatus: normalizeBusinessStatus(resource.businessStatus),
    rating: resource.rating ?? null,
    userRatingCount: resource.userRatingCount ?? 0,
    websiteUri,
    pureServiceArea: resource.pureServiceAreaBusiness === true,
    brandId: null,
    coordinates,
  };
}

function normalizeBusinessStatus(value: string | undefined): BusinessStatus {
  switch (value) {
    case "OPERATIONAL":
    case "CLOSED_TEMPORARILY":
    case "CLOSED_PERMANENTLY":
    case "FUTURE_OPENING":
      return value;
    default:
      return "UNKNOWN";
  }
}

export class GooglePlacesDiscovery implements PlaceDiscovery {
  readonly #apiKey: string;
  readonly #fetch: FetchLike;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #maxRetries: number;

  constructor(options: PlacesDiscoveryOptions) {
    this.#apiKey = options.apiKey;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#sleep = options.sleep ?? sleepMs;
    this.#maxRetries = options.maxRetries ?? 4;
  }

  async discover(circle: QueryCircle): Promise<DiscoveryResult> {
    const byId = new Map<string, Place>();
    const passes: DiscoveryPassResult[] = [];

    const nearby = await this.#nearby(circle);
    for (const place of nearby.places) byId.set(place.placeId, place);
    passes.push(nearby.pass);

    for (const term of SERVICE_AREA_TERMS) {
      const text = await this.#textSearch(circle, term);
      for (const place of text.places) {
        if (!byId.has(place.placeId)) byId.set(place.placeId, place);
      }
      passes.push(text.pass);
    }

    return { places: [...byId.values()], passes };
  }

  async #nearby(
    circle: QueryCircle,
  ): Promise<{ places: Place[]; pass: DiscoveryPassResult }> {
    const body = {
      locationRestriction: {
        circle: {
          center: {
            latitude: circle.center.latitude,
            longitude: circle.center.longitude,
          },
          radius: circle.radiusMeters,
        },
      },
      rankPreference: "DISTANCE",
      excludedTypes: [...EXCLUDE_TYPES],
      maxResultCount: NEARBY_MAX,
    };

    const response = await this.#postJson<NearbySearchResponse>(
      NEARBY_URL,
      body,
    );
    const places = (response.places ?? []).map(mapGooglePlace);

    return {
      places,
      pass: {
        kind: "nearby",
        query: null,
        resultCount: places.length,
        perRequestMaximum: NEARBY_MAX,
        requestsIssued: 1,
      },
    };
  }

  async #textSearch(
    circle: QueryCircle,
    term: string,
  ): Promise<{ places: Place[]; pass: DiscoveryPassResult }> {
    const byId = new Map<string, Place>();
    let pageToken: string | undefined;
    let requestsIssued = 0;
    let firstPageCount = 0;

    for (let page = 0; page < TEXT_SEARCH_PAGE_CAP; page += 1) {
      const body: Record<string, unknown> = {
        textQuery: term,
        rankPreference: "DISTANCE",
        locationBias: {
          circle: {
            center: {
              latitude: circle.center.latitude,
              longitude: circle.center.longitude,
            },
            radius: circle.radiusMeters,
          },
        },
        includePureServiceAreaBusinesses: true,
        pageSize: TEXT_PAGE_MAX,
      };
      if (pageToken) body.pageToken = pageToken;

      const response = await this.#postJson<TextSearchResponse>(TEXT_URL, body);
      requestsIssued += 1;

      const pagePlaces = (response.places ?? []).map(mapGooglePlace);
      if (page === 0) firstPageCount = pagePlaces.length;
      for (const place of pagePlaces) byId.set(place.placeId, place);

      pageToken = response.nextPageToken;
      if (!pageToken) break;
      // Tokens are not valid immediately; a short pause avoids spurious 400s.
      await this.#sleep(jitter(1200));
    }

    return {
      places: [...byId.values()],
      pass: {
        kind: "text",
        query: term,
        // Saturation is judged on the first page against the per-request cap.
        resultCount: firstPageCount,
        perRequestMaximum: TEXT_PAGE_MAX,
        requestsIssued,
      },
    };
  }

  async #postJson<T>(url: string, body: unknown): Promise<T> {
    let attempt = 0;
    for (;;) {
      const response = await this.#fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.#apiKey,
          "X-Goog-FieldMask": DISCOVERY_FIELD_MASK,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429 || response.status === 503) {
        if (attempt >= this.#maxRetries) {
          throw new PlacesQuotaError(
            `Places API rate-limited after ${attempt + 1} attempts`,
          );
        }
        const backoff = jitter(400 * 2 ** attempt);
        attempt += 1;
        await this.#sleep(backoff);
        continue;
      }

      const text = await response.text();
      if (!response.ok) {
        throw new PlacesAdapterError(
          `Places API ${response.status}: ${text.slice(0, 400)}`,
          response.status,
        );
      }

      try {
        return JSON.parse(text) as T;
      } catch (cause) {
        throw new PlacesAdapterError(
          "Malformed Places API response body",
          null,
          { cause },
        );
      }
    }
  }
}
