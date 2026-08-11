import type {
  GeocodeResult,
  Geocoder,
} from "../../../application/ports/geocoder.js";

export type FetchLike = typeof fetch;

interface GeocodeApiResponse {
  status: string;
  results?: Array<{
    formatted_address: string;
    partial_match?: boolean;
    geometry: {
      location: { lat: number; lng: number };
      location_type?: string;
    };
  }>;
  error_message?: string;
}

export class GeocoderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "GeocoderError";
  }
}

/**
 * Geocoding adapter. Ambiguity is a distinct outcome: silently taking the first
 * of several candidates would sweep the wrong place.
 */
export class GoogleGeocoder implements Geocoder {
  readonly #apiKey: string;
  readonly #fetch: FetchLike;

  constructor(apiKey: string, fetchImpl: FetchLike = fetch) {
    this.#apiKey = apiKey;
    this.#fetch = fetchImpl;
  }

  async resolve(address: string): Promise<GeocodeResult> {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", this.#apiKey);

    const response = await this.#fetch(url);
    if (!response.ok) {
      throw new GeocoderError(`Geocoding HTTP ${response.status}`);
    }

    let body: GeocodeApiResponse;
    try {
      body = (await response.json()) as GeocodeApiResponse;
    } catch (cause) {
      throw new GeocoderError("Malformed geocoding response", { cause });
    }

    if (body.status === "ZERO_RESULTS") {
      return { kind: "unresolvable" };
    }
    if (body.status === "OVER_QUERY_LIMIT" || body.status === "REQUEST_DENIED") {
      throw new GeocoderError(
        `Geocoding upstream failure: ${body.status} ${body.error_message ?? ""}`.trim(),
      );
    }
    if (body.status !== "OK" || !body.results || body.results.length === 0) {
      return { kind: "unresolvable" };
    }

    const confident = body.results.filter((result) => {
      if (result.partial_match) return false;
      const locationType = result.geometry.location_type ?? "";
      return (
        locationType === "ROOFTOP" ||
        locationType === "RANGE_INTERPOLATED" ||
        locationType === "GEOMETRIC_CENTER"
      );
    });

    const candidates = confident.length > 0 ? confident : body.results;

    if (candidates.length > 1) {
      return {
        kind: "ambiguous",
        candidates: candidates.map((c) => c.formatted_address),
      };
    }

    const [first] = candidates;
    if (!first) return { kind: "unresolvable" };

    return {
      kind: "resolved",
      coordinates: {
        latitude: first.geometry.location.lat,
        longitude: first.geometry.location.lng,
      },
      formattedAddress: first.formatted_address,
    };
  }
}
