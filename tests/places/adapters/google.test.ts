import { afterEach, describe, expect, it, vi } from 'vitest';
import { GooglePlacesAdapter } from '../../../src/places/adapters/google.js';
import { GoogleGenericError, GoogleNotFoundError } from '../../../src/places/domain/errors.js';
import type { Logger } from '../../../src/shared/logging/logger.js';

function createLoggerSpy(): Logger {
  const logger = {
    child: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  };

  logger.child.mockReturnValue(logger);

  return logger as unknown as Logger;
}

describe('GooglePlacesAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('logs the google response body when nearby search is not ok', async () => {
    const logger = createLoggerSpy();
    const errorBody = { error: { message: 'Not Found' } };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => errorBody
      })
    );

    const adapter = new GooglePlacesAdapter({ apiKey: 'test-key', baseUrl: 'https://example.test' }, logger);

    await expect(adapter.getPlaces(1, 2, 100)).rejects.toBeInstanceOf(
      GoogleNotFoundError
    );

    expect(logger.child).toHaveBeenCalledWith({
      url: 'https://example.test/places:searchNearby',
      method: 'POST'
    });
    expect(logger.error).toHaveBeenCalledWith(
      { status: 404, error: errorBody },
      'external google places api request failed'
    );
  });

  it('returns places when the success response matches the expected shape', async () => {
    const logger = createLoggerSpy();
    const places = [{ id: 'place-1', displayName: { text: 'Cafe', languageCode: 'en' } }];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ places })
      })
    );

    const adapter = new GooglePlacesAdapter({ apiKey: 'test-key', baseUrl: 'https://example.test' }, logger);

    await expect(adapter.getPlaces(1, 2, 100)).resolves.toEqual(places);

    expect(logger.info).toHaveBeenCalledWith(
      { latitude: 1, longitude: 2, radiusMeters: 100 },
      'google search request successful'
    );
  });

  it('throws when the success response body does not match the expected shape', async () => {
    const logger = createLoggerSpy();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ places: [{ displayName: { text: 'missing id' } }] })
      })
    );

    const adapter = new GooglePlacesAdapter({ apiKey: 'test-key', baseUrl: 'https://example.test' }, logger);

    await expect(adapter.getPlaces(1, 2, 100)).rejects.toBeInstanceOf(
      GoogleGenericError
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ issues: expect.any(Array) }),
      'invalid google places api response shape'
    );
  });

  it('defaults to an empty list when places is omitted', async () => {
    const logger = createLoggerSpy();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({})
      })
    );

    const adapter = new GooglePlacesAdapter({ apiKey: 'test-key', baseUrl: 'https://example.test' }, logger);

    await expect(adapter.getPlaces(1, 2, 100)).resolves.toEqual([]);
  });
});
