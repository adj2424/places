import { nominatimToLatLng } from './display-geocode'

describe('nominatimToLatLng', () => {
  it('converts Nominatim GeoJSON [lon, lat] to Leaflet { lat, lng }', () => {
    expect(nominatimToLatLng([-74.006, 40.7128])).toEqual({
      lat: 40.7128,
      lng: -74.006,
    })
  })

  it('reads Nominatim search JSON lat/lon fields', () => {
    expect(nominatimToLatLng({ lat: '40.7128', lon: '-74.006' })).toEqual({
      lat: 40.7128,
      lng: -74.006,
    })
  })
})
