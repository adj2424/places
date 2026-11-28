import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { labelForPrimaryType, PRIMARY_TYPE_KEYS } from '../places/catalog'
import {
  buildFindPlacesBody,
  DEFAULT_RADIUS_METERS,
  isValidRadius,
  MAX_RADIUS_METERS,
  MIN_RADIUS_METERS,
} from './search-request'
import type { SearchMode } from './search-request'
import type { FindPlacesRequest } from '../places/types'

const fieldInputClass =
  'w-full max-w-md rounded-lg border border-border bg-bg px-3 py-2 text-heading disabled:cursor-not-allowed disabled:bg-border/40 disabled:text-muted'

type SearchFormProps = {
  disabled?: boolean
  onSubmitSearch: (body: FindPlacesRequest) => void
}

function readRadius(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function requestCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
    })
  })
}

export function SearchForm({ disabled = false, onSubmitSearch }: SearchFormProps) {
  const addressId = useId()
  const radiusId = useId()
  const [mode, setMode] = useState<SearchMode>('address')
  const [address, setAddress] = useState('')
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locationDisabled, setLocationDisabled] = useState(false)
  const [locating, setLocating] = useState(false)

  const addressReady =
    mode === 'address' &&
    buildFindPlacesBody({
      mode: 'address',
      address,
      radiusMeters,
      primaryTypes: selectedTypes,
    }).ok
  const locationReady =
    mode === 'location' && !locationDisabled && isValidRadius(radiusMeters)
  const canSubmit = !disabled && !locating && (addressReady || locationReady)

  function toggleType(key: string) {
    setSelectedTypes((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    )
  }

  function chooseMode(next: SearchMode) {
    if (next === 'location' && locationDisabled) {
      return
    }
    setMode(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled || locating) {
      return
    }

    if (mode === 'address') {
      const result = buildFindPlacesBody({
        mode: 'address',
        address,
        radiusMeters,
        primaryTypes: selectedTypes,
      })
      if (!result.ok) {
        return
      }
      onSubmitSearch(result.body)
      return
    }

    if (locationDisabled || !navigator.geolocation) {
      setLocationDisabled(true)
      setLocationError('Current location is unavailable in this browser.')
      setMode('address')
      return
    }

    setLocating(true)
    setLocationError(null)

    try {
      const position = await requestCurrentPosition()
      const result = buildFindPlacesBody({
        mode: 'location',
        address,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        radiusMeters,
        primaryTypes: selectedTypes,
      })
      if (!result.ok) {
        return
      }
      onSubmitSearch(result.body)
    } catch {
      setLocationDisabled(true)
      setLocationError('Location permission was denied. Use an address instead.')
      setMode('address')
    } finally {
      setLocating(false)
    }
  }

  return (
    <form
      className="mb-5 grid gap-4 rounded-xl border border-border bg-surface p-4 shadow-panel"
      onSubmit={handleSubmit}
    >
      <fieldset
        className="m-0 flex flex-wrap gap-4 border-0 p-0"
        disabled={disabled}
      >
        <legend className="sr-only">Search origin</legend>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="search-mode"
            value="address"
            checked={mode === 'address'}
            onChange={() => chooseMode('address')}
          />
          Address
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="search-mode"
            value="location"
            checked={mode === 'location'}
            disabled={locationDisabled}
            onChange={() => chooseMode('location')}
          />
          Current location
        </label>
      </fieldset>

      {locationError ? (
        <p className="text-danger" role="status">
          {locationError}
        </p>
      ) : null}

      <div className="grid gap-1.5">
        <label htmlFor={addressId}>Address</label>
        <input
          id={addressId}
          type="text"
          name="address"
          autoComplete="street-address"
          className={fieldInputClass}
          value={mode === 'location' ? 'Your Location' : address}
          disabled={disabled || mode !== 'address'}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Street, city, or place"
        />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={radiusId}>Radius (meters)</label>
        <input
          id={radiusId}
          type="number"
          name="radiusMeters"
          min={MIN_RADIUS_METERS}
          max={MAX_RADIUS_METERS}
          step={1}
          className={fieldInputClass}
          value={Number.isFinite(radiusMeters) ? radiusMeters : ''}
          disabled={disabled}
          onChange={(event) => setRadiusMeters(readRadius(event.target.value))}
        />
      </div>

      <fieldset
        className="m-0 border-0 border-t border-border p-0 pt-3"
        disabled={disabled}
      >
        <legend className="p-0 font-semibold text-heading">
          Categories (optional)
        </legend>
        <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-x-3 gap-y-2">
          {PRIMARY_TYPE_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="primaryTypes"
                value={key}
                checked={selectedTypes.includes(key)}
                onChange={() => toggleType(key)}
              />
              {labelForPrimaryType(key)}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        className="cursor-pointer justify-self-start rounded-lg border-0 bg-accent px-4 py-2.5 text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55"
        disabled={!canSubmit}
      >
        {locating ? 'Locating…' : 'Search nearby'}
      </button>
    </form>
  )
}
