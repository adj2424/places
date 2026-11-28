import type { Coordinates } from './coordinates.js';
import type { GooglePlace, PrimaryType } from './google-places.js';

export type PlacesSearchResult = {
  places: GooglePlace[];
  googlePlacesApiCalls: number;
};

export interface PlacesService {
  getPlaces(coordinates: Coordinates, radiusMeters: number, primaryTypes: PrimaryType[], signal?: AbortSignal): Promise<PlacesSearchResult>;
  getCoordinatesByAddress(address: string): Promise<Coordinates>;
}
