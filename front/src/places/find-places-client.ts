import type {
  FindPlacesRequest,
  FindPlacesResult,
  NearbyPlace,
} from './types'

const DEFAULT_BASE_URL = 'http://127.0.0.1:3001'

const TOO_MANY_TYPES_ERROR = 'google too many types included in primary types'

function resolveBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_PLACES_BASE_URL
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.replace(/\/$/, '')
  }
  return DEFAULT_BASE_URL
}

function isNearbyPlace(value: unknown): value is NearbyPlace {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return typeof (value as { id?: unknown }).id === 'string'
}

function isAddressRequest(body: FindPlacesRequest): boolean {
  return 'address' in body
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function failureKind(
  status: number,
  payload: unknown,
  body: FindPlacesRequest,
): 'retryable' | 'invalid' | 'too-many-types' {
  if (status !== 400) {
    return 'retryable'
  }
  if (typeof payload !== 'object' || payload === null) {
    return 'retryable'
  }
  const error = (payload as { error?: unknown }).error
  if (typeof error !== 'string') {
    return 'retryable'
  }
  if (error === TOO_MANY_TYPES_ERROR) {
    return 'too-many-types'
  }
  if (!isAddressRequest(body)) {
    return 'retryable'
  }
  return 'invalid'
}

export async function findPlaces(
  body: FindPlacesRequest,
): Promise<FindPlacesResult> {
  try {
    const response = await fetch(`${resolveBaseUrl()}/find-places`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const payload = await readJson(response)
      return { ok: false, kind: failureKind(response.status, payload, body) }
    }

    const payload = await readJson(response)
    if (payload === undefined) {
      return { ok: false, kind: 'retryable' }
    }

    if (typeof payload !== 'object' || payload === null) {
      return { ok: false, kind: 'retryable' }
    }

    const { places, total, googlePlacesApiCalls } = payload as {
      places?: unknown
      total?: unknown
      googlePlacesApiCalls?: unknown
    }
    if (!Array.isArray(places) || typeof total !== 'number') {
      return { ok: false, kind: 'retryable' }
    }
    if (!places.every(isNearbyPlace)) {
      return { ok: false, kind: 'retryable' }
    }

    const data = { places, total }
    if (
      typeof googlePlacesApiCalls === 'number' &&
      Number.isSafeInteger(googlePlacesApiCalls) &&
      googlePlacesApiCalls >= 0
    ) {
      return { ok: true, data: { ...data, googlePlacesApiCalls } }
    }
    return { ok: true, data }
  } catch {
    return { ok: false, kind: 'retryable' }
  }
}
