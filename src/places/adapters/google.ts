import { z } from 'zod';
import type { GoogleConfig } from '../../composition/config.js';
import type { Logger } from '../../shared/logging/logger.js';
import { GenericError, UnavailableError, mapGoogleHttpStatusToError } from '../domain/errors.js';
import { type GooglePlacesResponse, type GooglePlace, type PrimaryType, PrimaryTypes } from '../domain/google.js';

const googlePlaceSchema = z.object({
  id: z.string(),
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
    'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.types,places.primaryType';

  constructor(
    private readonly config: GoogleConfig,
    private readonly logger: Logger
  ) {}

  async getPlaces(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    primaryTypes: PrimaryType[]
  ): Promise<GooglePlace[]> {
    const started = Date.now();
    const url = `${this.config.placesBaseUrl}/places:searchNearby`;
    const requestLogger = this.logger.child({
      url,
      method: 'POST'
    });

    let response: Response;

    requestLogger.info({ latitude, longitude, radiusMeters, primaryTypes }, 'google search request');

    try {
      response = await fetch(url, {
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
    } catch {
      throw new UnavailableError(Date.now() - started);
    }

    if (!response.ok) {
      const error = await response.json();
      requestLogger.error({ status: response.status, error }, 'external google places api request failed');
      throw mapGoogleHttpStatusToError(response.status, Date.now() - started);
    }

    const raw = await response.json();
    const parsed = googlePlacesResponseSchema.safeParse(raw);

    if (!parsed.success) {
      requestLogger.error({ issues: parsed.error.issues }, 'invalid google places api response shape');
      throw new GenericError(Date.now() - started);
    }

    requestLogger.info('google search request successful');
    return parsed.data.places ?? ([] as GooglePlace[]);
  }
}
