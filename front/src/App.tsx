import { lazy, Suspense, useRef, useState } from 'react'
import { findPlaces } from './places/find-places-client'
import type { FindPlacesRequest, FindPlacesResponse } from './places/types'
import { geocodeAddress } from './map/display-geocode'
import type { LatLng } from './map/display-geocode'
import { SearchForm } from './search/SearchForm'
import { PlaceList } from './results/PlaceList'
import type { PlaceListStatus } from './results/PlaceList'
import { DEFAULT_RADIUS_METERS } from './search/search-request'
const SearchAreaMap = lazy(() => import('./map/SearchAreaMap'))

const MAP_MISS_NOTICE =
  'Could not place this address on the map. Search results are still shown.'

type SearchFlags = {
  generation: number
  placesOk: boolean | null
  nominatimMissed: boolean
}

function originFromBody(body: FindPlacesRequest): LatLng | null {
  if ('latitude' in body) {
    return { lat: body.latitude, lng: body.longitude }
  }
  return null
}

export default function App() {
  const requestGeneration = useRef(0)
  const searchFlags = useRef<SearchFlags>({
    generation: 0,
    placesOk: null,
    nominatimMissed: false,
  })
  const [status, setStatus] = useState<PlaceListStatus>('idle')
  const [results, setResults] = useState<FindPlacesResponse | null>(null)
  const [origin, setOrigin] = useState<LatLng | null>(null)
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS)
  const [mapNotice, setMapNotice] = useState<string | null>(null)

  function showMapMissNoticeIfSearchSucceeded(generation: number) {
    const flags = searchFlags.current
    if (flags.generation !== generation) {
      return
    }
    if (flags.placesOk === true && flags.nominatimMissed) {
      setMapNotice(MAP_MISS_NOTICE)
    }
  }

  async function handleSearch(body: FindPlacesRequest) {
    const generation = ++requestGeneration.current
    searchFlags.current = {
      generation,
      placesOk: null,
      nominatimMissed: false,
    }
    setResults(null)
    setStatus('loading')
    setRadiusMeters(body.radiusMeters)
    setMapNotice(null)

    const knownOrigin = originFromBody(body)
    if (knownOrigin) {
      setOrigin(knownOrigin)
    } else if ('address' in body) {
      setOrigin(null)
      void geocodeAddress(body.address).then((resolved) => {
        if (generation !== requestGeneration.current) {
          return
        }
        if (resolved) {
          setOrigin(resolved)
          return
        }
        searchFlags.current.nominatimMissed = true
        showMapMissNoticeIfSearchSucceeded(generation)
      })
    }

    const result = await findPlaces(body)
    if (generation !== requestGeneration.current) {
      return
    }

    if (!result.ok) {
      searchFlags.current.placesOk = false
      setStatus(
        result.kind === 'invalid'
          ? 'invalid'
          : result.kind === 'too-many-types'
            ? 'too-many-types'
            : 'error',
      )
      setMapNotice(null)
      return
    }

    searchFlags.current.placesOk = true
    setResults(result.data)
    setStatus('success')
    showMapMissNoticeIfSearchSucceeded(generation)
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 pb-10">
      <header className="mb-5">
        <h1 className="mb-1.5 text-3xl font-semibold tracking-tight text-heading">
          Nearby explorer
        </h1>
        <p className="text-muted">
          Search places around an address or your current location.
        </p>
      </header>

      <SearchForm onSubmitSearch={handleSearch} />

      {mapNotice ? (
        <p
          className="mb-4 rounded-lg border border-border bg-surface px-3.5 py-3"
          role="status"
        >
          {mapNotice}
        </p>
      ) : null}

      <div className="grid items-start gap-4 md:grid-cols-2">
        <Suspense
          fallback={
            <div className="min-h-72 overflow-hidden rounded-xl border border-border bg-surface">
              <p className="p-4 text-muted">Loading map…</p>
            </div>
          }
        >
          <SearchAreaMap origin={origin} radiusMeters={radiusMeters} />
        </Suspense>
        <PlaceList
          status={status}
          places={results?.places ?? []}
          total={results?.total ?? null}
          googlePlacesApiCalls={results?.googlePlacesApiCalls}
        />
      </div>
    </div>
  )
}
