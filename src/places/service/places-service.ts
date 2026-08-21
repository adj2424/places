import type { GooglePlacesAdapter } from '../adapters/google.js';
import type { GooglePlace, PrimaryType } from '../domain/google.js';
import type { PlacesService } from '../domain/port.js';

export class PlacesServiceImpl implements PlacesService {
  constructor(private readonly googlePlacesAdapter: GooglePlacesAdapter) {}

  async getPlaces(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    primaryTypes: PrimaryType[]
  ): Promise<GooglePlace[]> {
    const places = await this.googlePlacesAdapter.getPlaces(latitude, longitude, radiusMeters, primaryTypes);
    return places.filter(place => hasNoWebsite(place.websiteUri));
  }
}

function hasNoWebsite(websiteUri: string | null | undefined): boolean {
  return websiteUri == null || websiteUri === '';
}
