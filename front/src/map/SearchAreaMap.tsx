import { useEffect } from 'react'
import { Circle, CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet'
import { boundsForSearchArea } from './search-area-bounds'
import 'leaflet/dist/leaflet.css'

export type SearchAreaMapProps = {
  origin: { lat: number; lng: number } | null
  radiusMeters: number
}

const FALLBACK_CENTER: [number, number] = [39.8283, -98.5795]

function FitToCircle({
  origin,
  radiusMeters,
}: {
  origin: { lat: number; lng: number }
  radiusMeters: number
}) {
  const map = useMap()

  useEffect(() => {
    map.fitBounds(boundsForSearchArea(origin, radiusMeters), {
      padding: [28, 28],
      maxZoom: 16,
    })
  }, [map, origin.lat, origin.lng, radiusMeters])

  return null
}

export default function SearchAreaMap({ origin, radiusMeters }: SearchAreaMapProps) {
  const center: [number, number] = origin
    ? [origin.lat, origin.lng]
    : FALLBACK_CENTER

  return (
    <div
      className="min-h-72 overflow-hidden rounded-xl border border-border bg-surface"
      aria-label="Search area"
    >
      <MapContainer
        center={center}
        zoom={origin ? 13 : 4}
        scrollWheelZoom
        className="h-72 w-full md:h-96"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {origin ? (
          <>
            <FitToCircle origin={origin} radiusMeters={radiusMeters} />
            <CircleMarker
              center={[origin.lat, origin.lng]}
              radius={6}
              pathOptions={{
                color: '#1d4ed8',
                fillColor: '#1d4ed8',
                fillOpacity: 1,
              }}
            />
            <Circle
              center={[origin.lat, origin.lng]}
              radius={radiusMeters}
              pathOptions={{
                color: '#1d4ed8',
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
              }}
            />
          </>
        ) : null}
      </MapContainer>
    </div>
  )
}
