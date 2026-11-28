import type { Coordinates } from './coordinates.js';

const EARTH_RADIUS_METERS = 6_371_008.8;
const RADIANS = Math.PI / 180;
// Allow for roundoff when a projected point lies exactly on a boundary.
const ROUNDING_METERS = 1e-7;

export type SearchCell = { east: number; north: number; halfSide: number };

export function subdivide(cell: SearchCell, originalRadius: number): SearchCell[] {
  const halfSide = cell.halfSide / 2;
  const children: SearchCell[] = [];
  for (const east of [cell.east - halfSide, cell.east + halfSide]) {
    for (const north of [cell.north - halfSide, cell.north + halfSide]) {
      const nearestEast = Math.max(0, Math.abs(east) - halfSide);
      const nearestNorth = Math.max(0, Math.abs(north) - halfSide);
      if (Math.hypot(nearestEast, nearestNorth) <= originalRadius + ROUNDING_METERS) {
        children.push({ east, north, halfSide });
      }
    }
  }
  return children;
}

// Rotate the origin toward its local east/north tangent direction on the sphere.
// This form also defines child centers when the search starts at either pole.
export function cellCenter(origin: Coordinates, cell: SearchCell): Coordinates {
  const distance = Math.hypot(cell.east, cell.north);
  if (distance === 0) return origin;
  const angle = distance / EARTH_RADIUS_METERS;
  const latitude = origin.latitude * RADIANS;
  const tangentScale = Math.sin(angle) / distance;
  const east = cell.east * tangentScale;
  const north = cell.north * tangentScale;
  const horizontal = Math.cos(angle) * Math.cos(latitude) - north * Math.sin(latitude);
  const vertical = Math.cos(angle) * Math.sin(latitude) + north * Math.cos(latitude);
  const longitude = origin.longitude + Math.atan2(east, horizontal) / RADIANS;
  return {
    latitude: Math.atan2(vertical, Math.hypot(horizontal, east)) / RADIANS,
    longitude: ((longitude + 540) % 360) - 180
  };
}

export function withinRadius(origin: Coordinates, place: Coordinates, radius: number): boolean {
  const halfLat = (place.latitude - origin.latitude) * RADIANS / 2;
  const halfLon = (place.longitude - origin.longitude) * RADIANS / 2;
  const haversine = Math.sin(halfLat) ** 2 +
    Math.cos(origin.latitude * RADIANS) * Math.cos(place.latitude * RADIANS) * Math.sin(halfLon) ** 2;
  const distance = 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
  return distance <= radius + ROUNDING_METERS;
}
