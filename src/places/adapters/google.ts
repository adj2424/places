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
    const url = `${this.config.baseUrl}v1/places:searchNearby`;
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
      this.logger.error('google request failed', { status: response.status, error: await response.json() });
      throw mapGoogleHttpStatusToError(response.status, Date.now() - started);
    }

    const data = (await response.json()) as GoogleNearbyResponse;

    this.logger.info('google request successful');
    return data.places;
  }
}

