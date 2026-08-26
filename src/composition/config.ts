import { z } from 'zod';
import type { LogLevel } from '../shared/logging/logger.js';

export type Config = {
  server: {
    port: number;
  };
  log: {
    level: LogLevel;
  };
  google: GoogleConfig;
};

export type GoogleConfig = {
  apiKey: string;
  placesBaseUrl: string;
  geocodingBaseUrl: string;
};

const configSchema = z.object({
  server: z.object({
    port: z.coerce.number().int().positive()
  }),
  log: z.object({
    level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  }),
  google: z.object({
    apiKey: z.string().min(1),
    placesBaseUrl: z.string().min(1),
    geocodingBaseUrl: z.string().min(1)
  })
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  try {
    return configSchema.parse({
      server: {
        port: Number(env.PORT ?? 3001)
      },
      log: {
        level: env.LOG_LEVEL ?? 'info'
      },
      google: {
        apiKey: env.GOOGLE_API_KEY,
        placesBaseUrl: env.GOOGLE_PLACES_BASE_URL,
        geocodingBaseUrl: env.GOOGLE_GEOCODING_BASE_URL
      }
    });
  } catch (error) {
    const errors = (error as z.ZodError).issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    throw new Error(`${errors.map(error => `${error.field}: ${error.message}`).join(', ')}`);
  }
}
