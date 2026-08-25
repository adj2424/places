import { z } from 'zod';
import type { GoogleConfig } from '../../composition/config.js';
import type { Logger } from '../../shared/logging/logger.js';
import type { Coordinates } from '../domain/coordinates.js';
import {
  GeocodeInvalidAddressError,
  GeocodeInvalidResponseError,
  GeocodeResourceExhaustedError,
  GeocodeUnavailableError,
  GeocodeUnexpectedError
} from '../domain/errors.js';
import type {
  GoogleGeocodeAddressComponent,
  GoogleGeocodeGeometry,
  GoogleGeocodeResponse,
  GoogleGeocodeResult,
  GoogleGeocodeStatus,
  GoogleLatLngBounds
} from '../domain/geocode.js';

const latLngBoundsSchema = z.object({
  northeast: z.object({
    lat: z.number().finite(),
    lng: z.number().finite()
  }),
  southwest: z.object({
    lat: z.number().finite(),
    lng: z.number().finite()
  })
}) satisfies z.ZodType<GoogleLatLngBounds>;

const addressComponentSchema = z.object({
  long_name: z.string(),
  short_name: z.string(),
  types: z.array(z.string())
}) satisfies z.ZodType<GoogleGeocodeAddressComponent>;

const geometrySchema = z.object({
  location: z.object({
    lat: z.number().finite(),
    lng: z.number().finite()
  }),
  location_type: z.enum(['ROOFTOP', 'RANGE_INTERPOLATED', 'GEOMETRIC_CENTER', 'APPROXIMATE']),
  viewport: latLngBoundsSchema,
  bounds: latLngBoundsSchema.optional()
}) satisfies z.ZodType<GoogleGeocodeGeometry>;

const geocodeResultSchema = z.object({
  address_components: z.array(addressComponentSchema),
  formatted_address: z.string(),
  geometry: geometrySchema,
  place_id: z.string(),
  types: z.array(z.string()),
  plus_code: z
    .object({
      global_code: z.string(),
      compound_code: z.string().optional()
    })
    .optional(),
  partial_match: z.boolean().optional(),
  postcode_localities: z.array(z.string()).optional()
}) satisfies z.ZodType<GoogleGeocodeResult>;

const geocodeResponseSchema = z.object({
  status: z.enum([
    'OK',
    'ZERO_RESULTS',
    'OVER_DAILY_LIMIT',
    'OVER_QUERY_LIMIT',
    'REQUEST_DENIED',
    'INVALID_REQUEST',
    'UNKNOWN_ERROR'
  ]),
  results: z.array(geocodeResultSchema),
  error_message: z.string().optional()
}) satisfies z.ZodType<GoogleGeocodeResponse>;

export class GoogleGeocodingAdapter {
  constructor(
    private readonly config: GoogleConfig,
    private readonly logger: Logger
  ) {}

  async geocode(address: string): Promise<Coordinates> {
    const started = Date.now();
    const params = new URLSearchParams({
      address,
      key: this.config.apiKey
    });
    const url = `${this.config.geocodingBaseUrl}?${params.toString()}`;
    const requestLogger = this.logger.child({
      url,
      method: 'GET'
    });

    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new GeocodeUnavailableError(Date.now() - started);
    }

    if (!response.ok) {
      const error = await response.json();
      requestLogger.error({ status: response.status, error }, 'geocode request failed');
      throw new GeocodeUnavailableError(Date.now() - started);
    }

    const raw = await response.json();
    const parsed = geocodeResponseSchema.safeParse(raw);

    if (!parsed.success) {
      requestLogger.error({ issues: parsed.error.issues }, 'invalid geocode response shape');
      throw new GeocodeInvalidResponseError(Date.now() - started);
    }

    const status = parsed.data.status;
    const results = parsed.data.results;

    if (status !== 'OK') {
      requestLogger.error({ status, resultCount: results.length }, 'geocode response classified with non-OK status');
    }

    classifyGeocodeResponse(status, Date.now() - started);

    const { lat, lng } = results[0]!.geometry.location;
    requestLogger.info(
      { coordinates: { latitude: lat, longitude: lng }, address },
      'google geocoding request successful'
    );
    return { latitude: lat, longitude: lng };
  }
}

function classifyGeocodeResponse(status: GoogleGeocodeStatus, durationMs: number): void {
  switch (status) {
    case 'OK':
      break;
    case 'ZERO_RESULTS':
      throw new GeocodeInvalidAddressError(durationMs);
    case 'OVER_QUERY_LIMIT':
      throw new GeocodeResourceExhaustedError(durationMs);
    case 'UNKNOWN_ERROR':
      throw new GeocodeUnexpectedError(durationMs);
    default:
      throw new GeocodeUnexpectedError(durationMs);
  }
}
