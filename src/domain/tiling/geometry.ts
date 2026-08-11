import type { Coordinates, QueryCircle } from "../model/geo.js";

const METERS_PER_DEGREE_LATITUDE = 111_320;
const EARTH_RADIUS_METERS = 6_371_008.8;

/**
 * A cell in a local metre plane whose origin is the sweep's request centre.
 * Working in metres keeps subdivision arithmetic exact; degrees would distort
 * every cell into a rectangle whose aspect ratio changes with latitude.
 */
export interface SquareMeters {
  readonly centerX: number;
  readonly centerY: number;
  readonly sideMeters: number;
}

export interface OffsetMeters {
  readonly x: number;
  readonly y: number;
}

/**
 * Radius of the circle that circumscribes a square of this side.
 *
 * Circumscribed, never inscribed. Nearby Search accepts only a circle, so a
 * square cell has to be queried as one — and an inscribed circle would leave
 * the square's four corners unqueried at every level of the tree, losing
 * businesses while every test still passed.
 */
export function circumscribedRadiusMeters(sideMeters: number): number {
  return (sideMeters * Math.SQRT2) / 2;
}

export function squareCorners(square: SquareMeters): readonly OffsetMeters[] {
  const half = square.sideMeters / 2;
  return [
    { x: square.centerX - half, y: square.centerY - half },
    { x: square.centerX + half, y: square.centerY - half },
    { x: square.centerX - half, y: square.centerY + half },
    { x: square.centerX + half, y: square.centerY + half },
  ];
}

/** The four quadrants of a square, which tile it exactly. */
export function childSquares(parent: SquareMeters): readonly SquareMeters[] {
  const side = parent.sideMeters / 2;
  const offset = side / 2;
  return [
    {
      centerX: parent.centerX - offset,
      centerY: parent.centerY - offset,
      sideMeters: side,
    },
    {
      centerX: parent.centerX + offset,
      centerY: parent.centerY - offset,
      sideMeters: side,
    },
    {
      centerX: parent.centerX - offset,
      centerY: parent.centerY + offset,
      sideMeters: side,
    },
    {
      centerX: parent.centerX + offset,
      centerY: parent.centerY + offset,
      sideMeters: side,
    },
  ];
}

export function offsetToCoordinates(
  origin: Coordinates,
  offset: OffsetMeters,
): Coordinates {
  const metersPerDegreeLongitude =
    METERS_PER_DEGREE_LATITUDE * Math.cos((origin.latitude * Math.PI) / 180);

  return {
    latitude: origin.latitude + offset.y / METERS_PER_DEGREE_LATITUDE,
    longitude: origin.longitude + offset.x / metersPerDegreeLongitude,
  };
}

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when `inner` lies wholly within `outer`. */
export function circleFullyContains(
  outer: QueryCircle,
  inner: QueryCircle,
): boolean {
  return (
    distanceMeters(outer.center, inner.center) + inner.radiusMeters <=
    outer.radiusMeters
  );
}

/**
 * True when any part of the square falls inside a circle centred on the metre
 * plane's origin. Used to drop cells in the corners of the root square that lie
 * entirely outside the radius the caller actually asked for.
 */
export function squareIntersectsOriginCircle(
  square: SquareMeters,
  radiusMeters: number,
): boolean {
  const half = square.sideMeters / 2;
  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const closestX = clamp(0, square.centerX - half, square.centerX + half);
  const closestY = clamp(0, square.centerY - half, square.centerY + half);

  return Math.hypot(closestX, closestY) <= radiusMeters;
}
