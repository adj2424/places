import type { GoogleConfig } from '../../composition/config.js';
import type { Logger } from '../../shared/logging/logger.js';
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
    const response = await fetch(`${this.config.baseUrl}v1/places:searchNearby`, {
      method: 'POST',
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
    if (!response.ok) {
      this.logger.error('google request returned non 200 status', {
        durationMs: Date.now() - started,
        statusCode: response.status,
        body: JSON.stringify(await response.json())
      });
      throw new Error('google request returned non 200 status');
    }

    const data = (await response.json()) as GoogleNearbyResponse;
    this.logger.info('google request successful', { durationMs: Date.now() - started });
    return data.places;
  }
}

