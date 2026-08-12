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
  baseUrl: string;
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
    baseUrl: z.string().min(1)
  })
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  try {
    return configSchema.parse({
      server: {
        port: Number(env.PORT ?? 3000)
      },
      log: {
        level: env.LOG_LEVEL ?? 'info'
      },
      google: {
        apiKey: env.GOOGLE_API_KEY,
        baseUrl: env.GOOGLE_BASE_URL
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
