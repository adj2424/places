export type NearbyPlace = {
  id: string
  name?: string
  address?: string
  phone?: string
  types?: string[]
  primaryType?: string
}

export type FindPlacesResponse = {
  places: NearbyPlace[]
  total: number
  googlePlacesApiCalls?: number
}

export type CoordinatesSearch = {
  latitude: number
  longitude: number
  radiusMeters: number
  primaryTypes?: string[]
}

export type AddressSearch = {
  address: string
  radiusMeters: number
  primaryTypes?: string[]
}

export type FindPlacesRequest = CoordinatesSearch | AddressSearch

export type FindPlacesSuccess = {
  ok: true
  data: FindPlacesResponse
}

export type FindPlacesFailure = {
  ok: false
  kind: 'retryable' | 'invalid' | 'too-many-types'
}

export type FindPlacesResult = FindPlacesSuccess | FindPlacesFailure
