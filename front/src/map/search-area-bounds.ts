import L from 'leaflet'

export function boundsForSearchArea(
  origin: { lat: number; lng: number },
  radiusMeters: number,
) {
  // Leaflet toBounds() uses full width; a circle of radius R needs diameter 2R.
  return L.latLng(origin.lat, origin.lng).toBounds(radiusMeters * 2)
}
