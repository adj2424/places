import { z } from 'zod';
import type { GoogleConfig } from '../../composition/config.js';
import type { Logger } from '../../shared/logging/logger.js';
import {
  GenericError,
  UnavailableError,
  mapGoogleHttpStatusToError,
  type GooglePlacesApiResponseError
} from '../domain/errors.js';
import {
  type GooglePlacesResponse,
  type GooglePlace,
  type PrimaryType,
  PrimaryTypes
} from '../domain/google-places.js';

const googlePlaceSchema = z.object({
  id: z.string(),
  location: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).optional(),
  types: z.array(z.string()).optional(),
  primaryType: z.string().optional(),
  displayName: z.object({ text: z.string(), languageCode: z.string() }).optional(),
  formattedAddress: z.string().optional(),
  nationalPhoneNumber: z.string().optional(),
  websiteUri: z.string().optional()
}) satisfies z.ZodType<GooglePlace>;

const googlePlacesResponseSchema = z.object({
  places: z.array(googlePlaceSchema).optional()
}) satisfies z.ZodType<GooglePlacesResponse>;

export class GooglePlacesAdapter {
  private readonly PLACES_NEARBY_FIELD_MASK =
    'places.id,places.location,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.types,places.primaryType';

  constructor(
    private readonly config: GoogleConfig,
    private readonly logger: Logger
  ) {}

  async getPlaces(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    primaryTypes: PrimaryType[],
    signal?: AbortSignal
  ): Promise<GooglePlace[]> {
    const started = Date.now();
    const url = `${this.config.placesBaseUrl}/places:searchNearby`;
    const requestLogger = this.logger.child({
      baseUrl: this.config.placesBaseUrl,
      method: 'POST'
    });

    requestLogger.debug({ latitude, longitude, radiusMeters, primaryTypes }, 'google search request');
    let response: Response;
    try {
      response = await fetch(url, {
        signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.config.apiKey,
          'X-Goog-FieldMask': this.PLACES_NEARBY_FIELD_MASK
        },
        body: JSON.stringify({
          includedPrimaryTypes: primaryTypes.flatMap(primaryType => PrimaryTypes[primaryType]),
          locationRestriction: {
            circle: {
              center: {
                latitude: latitude,
                longitude: longitude
              },
              radius: radiusMeters
            }
          }
        })
      });
    } catch (error) {
      requestLogger.error({ error }, 'external google places api request failed');
      throw new UnavailableError(Date.now() - started);
    }

    if (!response.ok) {
      const error = (await response.json()) as GooglePlacesApiResponseError;
      requestLogger.error({ status: response.status, error }, 'external google places api returned error response');
      throw mapGoogleHttpStatusToError(error, Date.now() - started);
    }

    const raw = await response.json();
    const parsed = googlePlacesResponseSchema.safeParse(raw);

    if (!parsed.success) {
      requestLogger.error({ issues: parsed.error.issues }, 'invalid google places api response shape');
      throw new GenericError(Date.now() - started);
    }

    const places = parsed.data.places ?? [];
    requestLogger.debug({ radiusMeters, resultCount: places.length }, 'google search request successful');
    return places;
  }
}

