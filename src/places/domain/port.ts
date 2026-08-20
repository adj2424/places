import type { GooglePlace } from './google.js';

export interface PlacesService {
  getPlaces(latitude: number, longitude: number, radiusMeters: number): Promise<GooglePlace[]>;
}
