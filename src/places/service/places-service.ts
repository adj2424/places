import type { GooglePlacesAdapter } from '../adapters/google.js';
import type { GooglePlace, SearchQuery } from '../domain/google.js';
import type { PlacesService } from '../domain/port.js';

export class PlacesServiceImpl implements PlacesService {
  constructor(private readonly googlePlacesAdapter: GooglePlacesAdapter) {}

  async getPlaces(query: SearchQuery): Promise<GooglePlace[]> {
    const places = await this.googlePlacesAdapter.getNearbyPlaces(query);
    return places.filter(place => hasNoWebsite(place.websiteUri));
  }
}

function hasNoWebsite(websiteUri: string | null | undefined): boolean {
  return websiteUri == null || websiteUri === '';
}
