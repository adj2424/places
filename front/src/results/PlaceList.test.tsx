import { render, screen } from '@testing-library/react'
import { PlaceList } from './PlaceList'
import type { NearbyPlace } from '../places/types'

const cafe: NearbyPlace = {
  id: 'place-1',
  name: 'Cafe Luna',
  address: '12 Main St',
  phone: '+1-555-0100',
}

describe('PlaceList', () => {
  it('shows a name-only row with no call or maps actions', () => {
    render(
      <PlaceList
        status="success"
        places={[{ id: 'sparse-1', name: 'Quiet Park' }]}
        total={1}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Quiet Park' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /call/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /open in maps/i })).toBeNull()
  })

  it('uses a tel href that matches the phone number', () => {
    render(<PlaceList status="success" places={[cafe]} total={1} />)

    const call = screen.getByRole('link', { name: /call/i })
    expect(call.getAttribute('href')).toBe('tel:+1-555-0100')
  })

  it('builds a maps href that contains the encoded address', () => {
    render(<PlaceList status="success" places={[cafe]} total={1} />)

    const maps = screen.getByRole('link', { name: /open in maps/i })
    expect(maps.getAttribute('href')).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('12 Main St')}`,
    )
    expect(maps.getAttribute('href')).toContain(encodeURIComponent('12 Main St'))
  })

  it('shows a total that matches places.length', () => {
    render(
      <PlaceList
        status="success"
        places={[cafe, { id: 'place-2', name: 'Bakery' }]}
        total={2}
      />,
    )

    expect(screen.getByText('2 places')).toBeTruthy()
  })

  it('keeps heading, count, and both cards for a two-place result', () => {
    render(
      <PlaceList
        status="success"
        places={[cafe, { id: 'place-2', name: 'Bakery' }]}
        total={2}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Results' })).toBeTruthy()
    expect(screen.getByText('2 places')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Cafe Luna' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Bakery' })).toBeTruthy()
  })

  it('renders every place in a long list', () => {
    const places = Array.from({ length: 20 }, (_, i) => ({
      id: `place-${i + 1}`,
      name: `Place ${i + 1}`,
    }))

    render(<PlaceList status="success" places={places} total={places.length} />)

    expect(screen.getByText('20 places')).toBeTruthy()
    for (const place of places) {
      expect(screen.getByRole('heading', { name: place.name })).toBeTruthy()
    }
  })

  it('does not show previous rows while loading', () => {
    const { rerender } = render(
      <PlaceList status="success" places={[cafe]} total={1} />,
    )
    expect(screen.getByRole('heading', { name: 'Cafe Luna' })).toBeTruthy()

    rerender(<PlaceList status="loading" places={[]} total={null} />)

    expect(screen.getByText(/searching nearby places/i)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Cafe Luna' })).toBeNull()
  })

  it('shows invalid-search copy and not retryable copy', () => {
    render(<PlaceList status="invalid" places={[]} total={null} />)

    expect(
      screen.getByText(
        'We couldn’t find that address. Check the spelling and try again.',
      ),
    ).toBeTruthy()
    expect(
      screen.queryByText('Search couldn’t be completed. Try again in a moment.'),
    ).toBeNull()
  })

  it('shows retryable copy and not invalid-search copy', () => {
    render(<PlaceList status="error" places={[]} total={null} />)

    expect(
      screen.getByText('Search couldn’t be completed. Try again in a moment.'),
    ).toBeTruthy()
    expect(
      screen.queryByText(
        'We couldn’t find that address. Check the spelling and try again.',
      ),
    ).toBeNull()
  })

  it('does not render a Retry control for either failure', () => {
    const { rerender } = render(
      <PlaceList status="invalid" places={[]} total={null} />,
    )
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /retry/i })).toBeNull()

    rerender(<PlaceList status="error" places={[]} total={null} />)
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /retry/i })).toBeNull()
  })
})
