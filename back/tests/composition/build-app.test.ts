import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../src/composition/build-app.js';
import { createLogger } from '../../src/shared/logging/logger.js';
import type { Config } from '../../src/composition/config.js';

function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    server: { port: 0, corsOrigin: 'http://localhost:3000' },
    log: { level: 'silent' },
    google: {
      apiKey: 'test-key',
      placesBaseUrl: 'https://places.googleapis.com/v1',
      geocodingBaseUrl: 'https://maps.googleapis.com/maps/api/geocode/json'
    },
    ...overrides
  };
}

describe('buildApp CORS', () => {
  it('allows a configured browser origin to preflight POST /find-places', async () => {
    const app = buildApp(testConfig(), createLogger('silent'));

    const response = await request(app)
      .options('/find-places')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
