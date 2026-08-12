import type { GooglePlace, SearchQuery } from './google.js';

export interface PlacesService {
  getPlaces(query: SearchQuery): Promise<GooglePlace[]>;
}
