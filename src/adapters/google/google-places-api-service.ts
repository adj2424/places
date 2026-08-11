import type { PlaceCandidate } from '../../domain/findplaces.js';
import type { GooglePlacesService, NearbySearchQuery } from '../../application/ports/google-places-service.js';
import { GoogleClient } from '../google/google-client.js';

export const PLACES_NEARBY_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri';

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
};

type GoogleNearbyResponse = {
  places: GooglePlace[];
};

function mapGooglePlace(place: GooglePlace): PlaceCandidate {
  return {
    id: place.id,
    name: place.displayName?.text ?? null,
    address: place.formattedAddress ?? null,
    phone: place.nationalPhoneNumber ?? null,
    websiteUri: place.websiteUri ?? null
  };
}

/** Places API adapter built on the shared Google client. */
export class GooglePlacesApiService implements GooglePlacesService {
  constructor(private readonly client: GoogleClient) {}

  async searchNearby(query: NearbySearchQuery): Promise<PlaceCandidate[]> {
    const data = await this.client.post<GoogleNearbyResponse>('/places:searchNearby', {
      fieldMask: PLACES_NEARBY_FIELD_MASK,
      body: {
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
      }
    });

    return data.places.map(e => mapGooglePlace(e));
  }
}

