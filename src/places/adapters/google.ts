import type { GooglePlace, GoogleNearbyResponse, SearchQuery } from '../domain/google.js';

export class GooglePlacesAdapter {
  constructor() {}

  private readonly PLACES_NEARBY_FIELD_MASK =
    'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri';

  async getNearbyPlaces(query: SearchQuery): Promise<GooglePlace[]> {
    let response: Response;
    try {
      response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_API_KEY!,
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
      throw new Error('google api unavailable');
    }

    const data = (await response.json()) as GoogleNearbyResponse;
    return data.places;
  }
}
