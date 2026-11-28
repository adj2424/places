import type { GooglePlacesAdapter } from '../adapters/google.js';
import type { GoogleGeocodingAdapter } from '../adapters/geocoding.js';
import type { GooglePlace, PrimaryType } from '../domain/google-places.js';
import type { PlacesSearchResult, PlacesService } from '../domain/port.js';
import type { Coordinates } from '../domain/coordinates.js';
import { cellCenter, subdivide, withinRadius, type SearchCell } from '../domain/search-area.js';
import { GenericError } from '../domain/errors.js';

const MIN_SUBDIVISION_RADIUS_METERS = 50;
const NEARBY_RESULT_CAP = 20;

export class PlacesServiceImpl implements PlacesService {
  constructor(
    private readonly googlePlacesAdapter: GooglePlacesAdapter,
    private readonly googleGeocodingAdapter: GoogleGeocodingAdapter
  ) {}

  async getPlaces(coordinates: Coordinates, radiusMeters: number, primaryTypes: PrimaryType[], signal?: AbortSignal): Promise<PlacesSearchResult> {
    const found = new Map<string, GooglePlace>();
    const root: SearchCell = { east: 0, north: 0, halfSide: radiusMeters };
    const pending = [root];
    let googlePlacesApiCalls = 0;
    while (pending.length > 0) {
      signal?.throwIfAborted();
      const cell = pending.pop()!;
      const center = cellCenter(coordinates, cell);
      const radius = cell === root ? radiusMeters : Math.max(MIN_SUBDIVISION_RADIUS_METERS, cell.halfSide * Math.SQRT2);
      const started = Date.now();
      googlePlacesApiCalls++;
      const places = await this.googlePlacesAdapter.getPlaces(center.latitude, center.longitude, radius, primaryTypes, signal);
      for (const place of places) {
        const existing = found.get(place.id);
        if (existing) {
          if (!existing.websiteUri?.trim() && place.websiteUri?.trim()) {
            found.set(place.id, { ...existing, websiteUri: place.websiteUri });
          }
          continue;
        }
        if (cell !== root) {
          if (!place.location) throw new GenericError(Date.now() - started);
          if (!withinRadius(coordinates, place.location, radiusMeters)) continue;
        }
        found.set(place.id, place);
      }
      if (places.length === NEARBY_RESULT_CAP && radius > MIN_SUBDIVISION_RADIUS_METERS) {
        pending.push(...subdivide(cell, radiusMeters));
      }
    }
    const placesWithoutWebsites = Array.from(found.values()).filter(place => !place.websiteUri?.trim());
    return { places: placesWithoutWebsites, googlePlacesApiCalls };
  }

  async getCoordinatesByAddress(address: string): Promise<Coordinates> {
    const coordinates = await this.googleGeocodingAdapter.geocode(address);
    return coordinates;
  }
}
