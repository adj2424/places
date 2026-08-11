export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * The only shape Nearby Search accepts as a location restriction. Square cells
 * from the quadtree are therefore queried with a circumscribed circle rather
 * than sent as rectangles.
 */
export interface QueryCircle {
  readonly center: Coordinates;
  readonly radiusMeters: number;
}
