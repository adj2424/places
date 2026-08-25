import type { Coordinates } from './coordinates.js';
import type { GooglePlace, PrimaryType } from './google-places.js';

export interface PlacesService {
  getPlaces(coordinates: Coordinates, radiusMeters: number, primaryTypes: PrimaryType[]): Promise<GooglePlace[]>;
  getCoordinatesByAddress(address: string): Promise<Coordinates>;
}
