import type { GoogleConfig } from '../../composition/config.js';
import type { Logger } from '../../shared/logging/logger.js';
import { GoogleGenericError, mapGoogleHttpStatusToError } from '../domain/errors.js';
import type { GooglePlace, GoogleNearbyResponse, SearchQuery } from '../domain/google.js';

export class GooglePlacesAdapter {
  private readonly PLACES_NEARBY_FIELD_MASK =
    'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri';

  constructor(
    private readonly config: GoogleConfig,
    private readonly logger: Logger
  ) {}

  async getNearbyPlaces(query: SearchQuery): Promise<GooglePlace[]> {
    const started = Date.now();
    const url = `${this.config.baseUrl}/places:searchNearby`;
    const requestLogger = this.logger.child({
      url,
      method: 'POST'
    });

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.config.apiKey,
          'X-Goog-FieldMask': this.PLACES_NEARBY_FIELD_MASK
        },
        body: JSON.stringify({
          maxResultCount: 20,
          locationRestriction: {
            circle: {
              center: {
                latitude: query.latitude,
                longitude: query.longitude
              },
              radius: query.radiusMeters
            }
          }
        })
      });
    } catch {
      throw new GoogleGenericError(Date.now() - started);
    }

    if (!response.ok) {
      const error = await response.json();
      requestLogger.error({ status: response.status, error }, 'external google places api request failed');
      throw mapGoogleHttpStatusToError(response.status, Date.now() - started);
    }

    const data = (await response.json()) as GoogleNearbyResponse;

    requestLogger.info('google request successful');
    return data.places;
  }
}
