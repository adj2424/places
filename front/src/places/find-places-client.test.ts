import { findPlaces } from './find-places-client'
import type { FindPlacesRequest } from './types'

const addressBody: FindPlacesRequest = {
  address: '1600 Amphitheatre Parkway',
  radiusMeters: 1000,
}

const coordinatesBody: FindPlacesRequest = {
  latitude: 37.422,
  longitude: -122.084,
  radiusMeters: 1000,
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

function htmlResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON')
    },
    text: async () => '<html>Internal Server Error</html>',
  } as Response
}

describe('findPlaces', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('treats 200 with an empty list as success, not failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { places: [], total: 0 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await findPlaces(addressBody)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://127.0.0.1:3001/find-places',
    )
    expect(result).toEqual({
      ok: true,
      data: { places: [], total: 0 },
    })
  })

  it('treats a rejected fetch as retryable failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )

    const result = await findPlaces(addressBody)

    expect(result).toEqual({ ok: false, kind: 'retryable' })
  })

  it('treats 500 HTML / non-JSON as retryable failure, not empty success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(htmlResponse(500)))

    const result = await findPlaces(addressBody)

    expect(result).toEqual({ ok: false, kind: 'retryable' })
  })

  it('maps id, name, address, and phone from a 200 place', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          places: [
            {
              id: 'place-1',
              name: 'Cafe Luna',
              address: '12 Main St',
              phone: '+1-555-0100',
            },
          ],
          total: 1,
        }),
      ),
    )

    const result = await findPlaces(addressBody)

    expect(result).toEqual({
      ok: true,
      data: {
        places: [
          {
            id: 'place-1',
            name: 'Cafe Luna',
            address: '12 Main St',
            phone: '+1-555-0100',
          },
        ],
        total: 1,
      },
    })
  })

  it('keeps id when optional fields are omitted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          places: [{ id: 'place-2' }],
          total: 1,
        }),
      ),
    )

    const result = await findPlaces(addressBody)

    expect(result).toEqual({
      ok: true,
      data: {
        places: [{ id: 'place-2' }],
        total: 1,
      },
    })
  })

  it('treats address-mode 400 with a string error as invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, { error: 'google geocoding invalid address' }),
      ),
    )

    const result = await findPlaces(addressBody)

    expect(result).toEqual({ ok: false, kind: 'invalid' })
  })

  it('treats address-mode 400 with an error array as retryable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(400, { error: [] })),
    )

    const result = await findPlaces(addressBody)

    expect(result).toEqual({ ok: false, kind: 'retryable' })
  })

  it('treats coordinates-mode 400 with a string error as retryable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, { error: 'google geocoding invalid address' }),
      ),
    )

    const result = await findPlaces(coordinatesBody)

    expect(result).toEqual({ ok: false, kind: 'retryable' })
  })

  it('treats 502 places-unavailable JSON as retryable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(502, { error: 'google places service unavailable' }),
      ),
    )

    const result = await findPlaces(addressBody)

    expect(result).toEqual({ ok: false, kind: 'retryable' })
  })

  it('treats 502 geocoding-unavailable JSON as retryable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(502, { error: 'google geocoding service unavailable' }),
      ),
    )

    const result = await findPlaces(addressBody)

    expect(result).toEqual({ ok: false, kind: 'retryable' })
  })
})
