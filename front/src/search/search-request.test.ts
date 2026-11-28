import { buildFindPlacesBody } from './search-request'
import type { SearchDraft } from './search-request'

const locationDraft: SearchDraft = {
  mode: 'location',
  address: 'should not be sent',
  latitude: 40.7128,
  longitude: -74.006,
  radiusMeters: 1000,
  primaryTypes: [],
}

describe('buildFindPlacesBody', () => {
  it('builds a location body with lat/lng and no address key', () => {
    const result = buildFindPlacesBody(locationDraft)

    expect(result).toEqual({
      ok: true,
      body: {
        latitude: 40.7128,
        longitude: -74.006,
        radiusMeters: 1000,
      },
    })
    if (result.ok) {
      expect(result.body).not.toHaveProperty('address')
    }
  })

  it('drops lat/lng when switching to address mode', () => {
    const result = buildFindPlacesBody({
      ...locationDraft,
      mode: 'address',
      address: '  12 Main St  ',
    })

    expect(result).toEqual({
      ok: true,
      body: {
        address: '12 Main St',
        radiusMeters: 1000,
      },
    })
    if (result.ok) {
      expect(result.body).not.toHaveProperty('latitude')
      expect(result.body).not.toHaveProperty('longitude')
    }
  })

  it('does not submit an empty address', () => {
    expect(
      buildFindPlacesBody({
        mode: 'address',
        address: '   ',
        radiusMeters: 1000,
        primaryTypes: [],
      }),
    ).toEqual({ ok: false, error: 'empty-address' })
  })

  it('builds an address body with trimmed address and no lat/lng', () => {
    const result = buildFindPlacesBody({
      mode: 'address',
      address: ' Boston, MA ',
      latitude: 1,
      longitude: 2,
      radiusMeters: 2500,
      primaryTypes: [],
    })

    expect(result).toEqual({
      ok: true,
      body: { address: 'Boston, MA', radiusMeters: 2500 },
    })
    if (result.ok) {
      expect(result.body).not.toHaveProperty('latitude')
      expect(result.body).not.toHaveProperty('longitude')
    }
  })

  it('does not submit radius 0 or 50001', () => {
    expect(
      buildFindPlacesBody({
        ...locationDraft,
        radiusMeters: 0,
      }),
    ).toEqual({ ok: false, error: 'invalid-radius' })

    expect(
      buildFindPlacesBody({
        ...locationDraft,
        radiusMeters: 50001,
      }),
    ).toEqual({ ok: false, error: 'invalid-radius' })
  })

  it('omits primaryTypes when none are selected', () => {
    const result = buildFindPlacesBody(locationDraft)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.body).not.toHaveProperty('primaryTypes')
    }
  })

  it('sends selected foodAndDrink as that catalog key, not restaurant', () => {
    const result = buildFindPlacesBody({
      mode: 'address',
      address: 'Boston, MA',
      radiusMeters: 1000,
      primaryTypes: ['foodAndDrink'],
    })

    expect(result).toEqual({
      ok: true,
      body: {
        address: 'Boston, MA',
        radiusMeters: 1000,
        primaryTypes: ['foodAndDrink'],
      },
    })
    if (result.ok && 'primaryTypes' in result.body) {
      expect(result.body.primaryTypes).not.toContain('restaurant')
    }
  })
})
