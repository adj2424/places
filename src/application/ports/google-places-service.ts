import type { PlaceCandidate } from "../../domain/findplaces.js";

export type NearbySearchQuery = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

/** Application port: Places-specific Google API operations. */
export type GooglePlacesService = {
  searchNearby(query: NearbySearchQuery): Promise<PlaceCandidate[]>;
};
