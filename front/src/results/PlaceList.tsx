import type { NearbyPlace } from '../places/types'

export type PlaceListStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'invalid'
  | 'too-many-types'
  | 'error'

export type PlaceListProps = {
  status: PlaceListStatus
  places: NearbyPlace[]
  total: number | null
  googlePlacesApiCalls?: number
}

const panel = 'rounded-xl border border-border bg-surface p-4'
const heading = 'mb-2 text-lg font-semibold tracking-tight text-heading'

function mapsSearchUrl(id: string, address: string, name?: string): string {
  const query = [name?.trim(), address].filter(Boolean).join(', ')
  const params = new URLSearchParams({ api: '1', query, query_place_id: id })
  return `https://www.google.com/maps/search/?${params}`
}

export function PlaceList({ status, places, total, googlePlacesApiCalls }: PlaceListProps) {
  if (status === 'idle') {
    return (
      <section className={panel} aria-live="polite">
        <h2 className={heading}>Results</h2>
        <p className="text-muted">Search nearby to see places here.</p>
      </section>
    )
  }

  if (status === 'loading') {
    return (
      <section className={panel} aria-live="polite" aria-busy="true">
        <h2 className={heading}>Results</h2>
        <p className="text-muted">Searching nearby places…</p>
      </section>
    )
  }

  if (status === 'invalid') {
    return (
      <section className={panel} aria-live="assertive">
        <h2 className={heading}>Results</h2>
        <p className="text-danger">
          We couldn’t find that address. Check the spelling and try again.
        </p>
      </section>
    )
  }

  if (status === 'too-many-types') {
    return (
      <section className={panel} aria-live="assertive">
        <h2 className={heading}>Results</h2>
        <p className="text-danger">
          Too many categories selected. Deselect some and search again.
        </p>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className={panel} aria-live="assertive">
        <h2 className={heading}>Results</h2>
        <p className="text-danger">
          Search couldn’t be completed. Try again in a moment.
        </p>
      </section>
    )
  }

  const count = total ?? places.length
  const apiCallCount = googlePlacesApiCalls === undefined ? null : (
    <p className="text-muted">
      {googlePlacesApiCalls} Google Places API {googlePlacesApiCalls === 1 ? 'call' : 'calls'}
    </p>
  )

  if (places.length === 0) {
    return (
      <section className={panel} aria-live="polite">
        <h2 className={heading}>Results</h2>
        <p className="text-muted">No places found in this area.</p>
        <p className="text-muted">{count} results</p>
        {apiCallCount}
      </section>
    )
  }

  return (
    <section className={panel} aria-live="polite">
      <h2 className={heading}>Results</h2>
      <p className="text-muted">
        {count} {count === 1 ? 'place' : 'places'}
      </p>
      {apiCallCount}
      <ul className="mt-3 grid max-h-72 list-none gap-3 overflow-auto p-0 md:max-h-96">
        {places.map((place) => (
          <li key={place.id}>
            <article className="border-t border-border pt-3">
              <h3 className="mb-1 text-base font-semibold tracking-tight text-heading">
                {place.name?.trim() || 'Unknown place'}
              </h3>
              {place.address ? <p className="text-muted">{place.address}</p> : null}
              <p className="mt-2 flex flex-wrap gap-3">
                {place.phone ? (
                  <a className="text-accent" href={`tel:${place.phone}`}>
                    Call {place.phone}
                  </a>
                ) : null}
                {place.address ? (
                  <a
                    className="text-accent"
                    href={mapsSearchUrl(place.id, place.address, place.name)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in maps
                  </a>
                ) : null}
              </p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
