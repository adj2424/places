import { boundsForSearchArea } from './search-area-bounds'

describe('boundsForSearchArea', () => {
  it('computes radius bounds without attaching a circle to a map', () => {
    const origin = { lat: 38.886, lng: -77.401 }
    const bounds = boundsForSearchArea(origin, 1000)

    expect(bounds.contains(origin)).toBe(true)
    expect(bounds.getNorth()).toBeGreaterThan(origin.lat)
    expect(bounds.getSouth()).toBeLessThan(origin.lat)
    expect(bounds.getEast()).toBeGreaterThan(origin.lng)
    expect(bounds.getWest()).toBeLessThan(origin.lng)
  })
})
