import type { GooglePlacesAdapter } from '../adapters/google.js';
import type { GoogleGeocodingAdapter } from '../adapters/geocoding.js';
import type { GooglePlace, PrimaryType } from '../domain/google.js';
import type { PlacesService } from '../domain/port.js';
import type { Coordinates } from '../domain/coordinates.js';

export class PlacesServiceImpl implements PlacesService {
  constructor(
    private readonly googlePlacesAdapter: GooglePlacesAdapter,
    private readonly googleGeocodingAdapter: GoogleGeocodingAdapter
  ) {}

  async getPlaces(coordinates: Coordinates, radiusMeters: number, primaryTypes: PrimaryType[]): Promise<GooglePlace[]> {
    const places = await this.googlePlacesAdapter.getPlaces(
      coordinates.latitude,
      coordinates.longitude,
      radiusMeters,
      primaryTypes
    );
    return places.filter(place => place.websiteUri == null || place.websiteUri === '' || true);
  }

  async getCoordinatesByAddress(address: string): Promise<Coordinates> {
    const coordinates = await this.googleGeocodingAdapter.geocode(address);
    return coordinates;
  }
}
