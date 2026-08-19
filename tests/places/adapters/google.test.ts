import { afterEach, describe, expect, it, vi } from 'vitest';
import { GooglePlacesAdapter } from '../../../src/places/adapters/google.js';
import { GoogleNotFoundError } from '../../../src/places/domain/errors.js';
import type { Logger } from '../../../src/shared/logging/logger.js';

function createLoggerSpy(): Logger {
  return {
    error: vi.fn(),
    info: vi.fn()
  } as unknown as Logger;
}

describe('GooglePlacesAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('logs the google response body text when nearby search is not ok', async () => {
    const logger = createLoggerSpy();
    const body = '{"error":{"message":"Not Found"}}';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => body
      })
    );

    const adapter = new GooglePlacesAdapter(
      { apiKey: 'test-key', baseUrl: 'https://example.test/' },
      logger
    );

    await expect(
      adapter.getNearbyPlaces({ latitude: 1, longitude: 2, radiusMeters: 100 })
    ).rejects.toBeInstanceOf(GoogleNotFoundError);

    expect(logger.error).toHaveBeenCalledWith(
      { status: 404, error: body },
      'google request failed'
    );
  });
});
