import { z } from 'zod';
import type { GoogleConfig } from '../../composition/config.js';
import type { Logger } from '../../shared/logging/logger.js';
import { GeocodeInvalidAddressError, GeocodeUnavailableError, GeocodeUnexpectedError } from '../domain/errors.js';
import type { Coordinates } from '../domain/coordinates.js';

const GEOCODE_HOST = 'maps.googleapis.com';
const GEOCODE_PATH = '/maps/api/geocode/json';

const geocodeLocationSchema = z.object({
  lat: z.number().finite(),
  lng: z.number().finite()
});

const geocodeResultSchema = z.object({
  partial_match: z.boolean().optional(),
  geometry: z
    .object({
      location: geocodeLocationSchema.optional()
    })
    .optional()
});

const geocodeResponseSchema = z.object({
  status: z.string(),
  results: z.array(geocodeResultSchema).optional()
});

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
    const requestLogger = this.logger.child({
      host: GEOCODE_HOST,
      method: 'GET'
    });

    let response: Response;
    try {
      response = await fetch(`https://${GEOCODE_HOST}${GEOCODE_PATH}?${params.toString()}`);
    } catch {
      throw new GeocodeUnavailableError(Date.now() - started);
    }

    if (!response.ok) {
      const durationMs = Date.now() - started;
      requestLogger.error({ status: response.status, resultCount: 0, durationMs }, 'geocode request failed');
      throw new GeocodeUnavailableError(durationMs);
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new GeocodeUnexpectedError(Date.now() - started);
    }

    const durationMs = Date.now() - started;
    const parsed = geocodeResponseSchema.safeParse(raw);
    if (!parsed.success) {
      requestLogger.error({ status: 'malformed', resultCount: 0, durationMs }, 'invalid geocode response shape');
      throw new GeocodeUnexpectedError(durationMs);
    }

    const status = parsed.data.status;
    const results = parsed.data.results ?? [];
    requestLogger.info({ status, resultCount: results.length, durationMs }, 'geocode response classified');

    return classifyGeocodeResponse(status, results, durationMs);
  }
}

function classifyGeocodeResponse(
  status: string,
  results: z.infer<typeof geocodeResultSchema>[],
  durationMs: number
): Coordinates {
  switch (status) {
    case 'ZERO_RESULTS':
      throw new GeocodeInvalidAddressError(durationMs);
    case 'OVER_QUERY_LIMIT':
    case 'UNKNOWN_ERROR':
      throw new GeocodeUnavailableError(durationMs);
    case 'OK':
      return classifyOkResults(results, durationMs);
    default:
      throw new GeocodeUnexpectedError(durationMs);
  }
}

function classifyOkResults(results: z.infer<typeof geocodeResultSchema>[], durationMs: number): Coordinates {
  const result = results[0];
  if (results.length !== 1 || result === undefined || result.partial_match === true) {
    throw new GeocodeInvalidAddressError(durationMs);
  }

  const location = result.geometry?.location;
  if (location === undefined) {
    throw new GeocodeUnexpectedError(durationMs);
  }

  return { latitude: location.lat, longitude: location.lng };
}
