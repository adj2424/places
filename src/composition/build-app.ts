import express, { type Express } from 'express';
import { echoMessage } from '../application/echo.js';
import { registerEchoRoutes } from '../adapters/http/echo-routes.js';
import { registerFindPlacesRoutes } from '../adapters/http/findplaces-routes.js';
import { registerHealthRoutes } from '../adapters/http/health-routes.js';
import { requestLogging } from '../adapters/http/request-logging.js';
import { createLogger, type Logger } from './logger.js';
import { GoogleClient } from '../adapters/google/google-client.js';
import type { Env } from './env.js';
import { GooglePlacesApiService } from '../adapters/google/google-places-api-service.js';

export type AppDeps = {
  env: Env;
  logger: Logger;
};

/** Shared app factory for process entry and HTTP tests. Does not listen. */
export function buildApp(deps: AppDeps): Express {
  const logger = deps.logger;
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use(requestLogging(logger));

  const googleClient = new GoogleClient({
    apiKey: deps.env.GOOGLE_PLACES_API_KEY!,
    baseUrl: 'https://places.googleapis.com/v1'
  });
  const googlePlacesService = new GooglePlacesApiService(googleClient);

  registerHealthRoutes(app);
  registerEchoRoutes(app, { echo: echoMessage });
  registerFindPlacesRoutes(app, googlePlacesService);

  return app;
}

