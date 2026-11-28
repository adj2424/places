import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SearchForm } from './SearchForm'

function addressInput(): HTMLInputElement {
  return screen.getByRole('textbox', { name: 'Address' })
}

function selectCurrentLocation() {
  fireEvent.click(screen.getByRole('radio', { name: /current location/i }))
}

function selectAddressMode() {
  fireEvent.click(screen.getByRole('radio', { name: /^address$/i }))
}

function mockGeolocationSuccess(latitude: number, longitude: number) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition(success: PositionCallback) {
        success({
          coords: {
            latitude,
            longitude,
            accuracy: 1,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition)
      },
    },
  })
}

function mockGeolocationDenied() {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition(
        _success: PositionCallback,
        error?: PositionErrorCallback,
      ) {
        error?.({
          code: 1,
          message: 'denied',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        })
      },
    },
  })
}

describe('SearchForm location-mode address overlay', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows Your Location and disables the field when current location is selected', () => {
    render(<SearchForm onSubmitSearch={() => {}} />)

    fireEvent.change(addressInput(), { target: { value: '12 Main St' } })
    selectCurrentLocation()

    expect(addressInput().value).toBe('Your Location')
    expect(addressInput().disabled).toBe(true)
  })

  it('restores the prior typed address when switching back to address mode', () => {
    render(<SearchForm onSubmitSearch={() => {}} />)

    fireEvent.change(addressInput(), { target: { value: '12 Main St' } })
    selectCurrentLocation()
    selectAddressMode()

    expect(addressInput().value).toBe('12 Main St')
    expect(addressInput().disabled).toBe(false)
  })

  it('shows Your Location even when the typed address is empty', () => {
    render(<SearchForm onSubmitSearch={() => {}} />)

    selectCurrentLocation()

    expect(addressInput().value).toBe('Your Location')
  })

  it('restores leftover address after geolocation denial, not Your Location', async () => {
    mockGeolocationDenied()
    render(<SearchForm onSubmitSearch={() => {}} />)

    fireEvent.change(addressInput(), { target: { value: '12 Main St' } })
    selectCurrentLocation()
    fireEvent.click(screen.getByRole('button', { name: /search nearby/i }))

    await waitFor(() => {
      expect(addressInput().value).toBe('12 Main St')
    })
    expect(addressInput().disabled).toBe(false)
    expect(screen.getByRole('radio', { name: /current location/i })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('submits coordinates without an address key', async () => {
    mockGeolocationSuccess(40.7128, -74.006)
    const onSubmitSearch = vi.fn()
    render(<SearchForm onSubmitSearch={onSubmitSearch} />)

    fireEvent.change(addressInput(), { target: { value: '12 Main St' } })
    selectCurrentLocation()
    fireEvent.click(screen.getByRole('button', { name: /search nearby/i }))

    await waitFor(() => {
      expect(onSubmitSearch).toHaveBeenCalledTimes(1)
    })
    expect(onSubmitSearch.mock.calls[0][0]).toEqual({
      latitude: 40.7128,
      longitude: -74.006,
      radiusMeters: 1000,
    })
    expect(onSubmitSearch.mock.calls[0][0]).not.toHaveProperty('address')
  })

  it('keeps leftover address after a submit when geolocation is missing', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    })
    render(<SearchForm onSubmitSearch={() => {}} />)

    fireEvent.change(addressInput(), { target: { value: '12 Main St' } })
    selectCurrentLocation()
    fireEvent.click(screen.getByRole('button', { name: /search nearby/i }))

    await waitFor(() => {
      expect(addressInput().value).toBe('12 Main St')
    })
    expect(screen.getByRole('radio', { name: /current location/i })).toHaveProperty(
      'disabled',
      true,
    )
  })
})
