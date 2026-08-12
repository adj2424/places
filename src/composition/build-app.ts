import express, { type Express } from 'express';
import { registerHealthRoutes } from '../health/adapters/health-routes.js';
import { registerPlacesRoutes } from '../places/adapters/find-places-route.js';
import { GooglePlacesAdapter } from '../places/adapters/google.js';
import type { PlacesService } from '../places/domain/port.js';
import { PlacesServiceImpl } from '../places/service/places-service.js';
import { GoogleClient } from '../shared/client/client.js';
import { requestLogging } from '../shared/logging/request-logging.js';
import type { Env } from './env.js';
import type { Logger } from './logger.js';

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

  const googlePlacesAdapter = new GooglePlacesAdapter();
  const placesService = new PlacesServiceImpl(googlePlacesAdapter);

  registerHealthRoutes(app);
  registerPlacesRoutes(app, placesService);

  return app;
}

