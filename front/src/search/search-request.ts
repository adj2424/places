import type { FindPlacesRequest } from '../places/types'

export const MIN_RADIUS_METERS = 1
export const MAX_RADIUS_METERS = 50_000
export const DEFAULT_RADIUS_METERS = 1000

export type SearchMode = 'address' | 'location'

export type SearchDraft = {
  mode: SearchMode
  address: string
  latitude?: number
  longitude?: number
  radiusMeters: number
  primaryTypes: string[]
}

export type SearchRequestError =
  | 'empty-address'
  | 'invalid-radius'
  | 'missing-coordinates'

export type BuildSearchResult =
  | { ok: true; body: FindPlacesRequest }
  | { ok: false; error: SearchRequestError }

export function isValidRadius(radiusMeters: number): boolean {
  return (
    Number.isFinite(radiusMeters) &&
    radiusMeters >= MIN_RADIUS_METERS &&
    radiusMeters <= MAX_RADIUS_METERS
  )
}

export function buildFindPlacesBody(draft: SearchDraft): BuildSearchResult {
  if (!isValidRadius(draft.radiusMeters)) {
    return { ok: false, error: 'invalid-radius' }
  }

  const primaryTypes =
    draft.primaryTypes.length > 0 ? draft.primaryTypes : undefined

  if (draft.mode === 'address') {
    const address = draft.address.trim()
    if (address.length === 0) {
      return { ok: false, error: 'empty-address' }
    }
    return {
      ok: true,
      body: primaryTypes
        ? { address, radiusMeters: draft.radiusMeters, primaryTypes }
        : { address, radiusMeters: draft.radiusMeters },
    }
  }

  if (
    typeof draft.latitude !== 'number' ||
    typeof draft.longitude !== 'number' ||
    !Number.isFinite(draft.latitude) ||
    !Number.isFinite(draft.longitude)
  ) {
    return { ok: false, error: 'missing-coordinates' }
  }

  return {
    ok: true,
    body: primaryTypes
      ? {
          latitude: draft.latitude,
          longitude: draft.longitude,
          radiusMeters: draft.radiusMeters,
          primaryTypes,
        }
      : {
          latitude: draft.latitude,
          longitude: draft.longitude,
          radiusMeters: draft.radiusMeters,
        },
  }
}
