export type LatLng = {
  lat: number
  lng: number
}

export function nominatimToLatLng(input: unknown): LatLng | null {
  if (Array.isArray(input) && input.length >= 2) {
    const lon = Number(input[0])
    const lat = Number(input[1])
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lng: lon }
    }
    return null
  }

  if (typeof input === 'object' && input !== null) {
    const record = input as { lat?: unknown; lon?: unknown; lng?: unknown }
    const lat = Number(record.lat)
    const lng = Number(record.lon ?? record.lng)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng }
    }
  }

  return null
}

export async function geocodeAddress(query: string): Promise<LatLng | null> {
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return null
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '1')
    url.searchParams.set('q', trimmed)

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'places-front/0.1 (local nearby-explorer)',
      },
    })
    if (!response.ok) {
      return null
    }

    const payload: unknown = await response.json()
    if (!Array.isArray(payload) || payload.length === 0) {
      return null
    }
    return nominatimToLatLng(payload[0])
  } catch {
    return null
  }
}
