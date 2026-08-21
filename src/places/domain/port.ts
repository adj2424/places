import type { GooglePlace, PrimaryType } from './google.js';

export interface PlacesService {
  getPlaces(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    primaryTypes: PrimaryType[]
  ): Promise<GooglePlace[]>;
}
