import express, { type Express } from 'express';
import { registerHealthRoutes } from '../health/adapters/health-routes.js';
import { HealthServiceImpl } from '../health/service/health-service.js';
import { registerPlacesRoutes } from '../places/adapters/find-places-route.js';
import { GooglePlacesHealthAdapter } from '../health/adapters/google-health.js';
import { GooglePlacesAdapter } from '../places/adapters/google.js';
import { PlacesServiceImpl } from '../places/service/places-service.js';
import type { Config } from './config.js';
import type { Logger } from '../shared/logging/logger.js';

export function buildApp(config: Config, logger: Logger): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  const healthLogger = logger.child({ component: 'health' });
  const placesLogger = logger.child({ component: 'places' });

  const googlePlacesHealthCheck = new GooglePlacesHealthAdapter(healthLogger);
  const healthService = new HealthServiceImpl(googlePlacesHealthCheck);

  const googlePlacesAdapter = new GooglePlacesAdapter(config.google, placesLogger);
  const placesService = new PlacesServiceImpl(googlePlacesAdapter);

  registerHealthRoutes(app, healthService, healthLogger);
  registerPlacesRoutes(app, placesService, placesLogger);

  return app;
}
