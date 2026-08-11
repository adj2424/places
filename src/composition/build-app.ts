import express, { type Express } from 'express';
import { echoMessage } from '../application/echo.js';
import { registerEchoRoutes, type EchoUseCase } from '../adapters/http/echo-routes.js';
import { registerHealthRoutes } from '../adapters/http/health-routes.js';
import { requestLogging } from '../adapters/http/request-logging.js';
import { createLogger, type Logger } from './logger.js';
import type { Env } from './env.js';

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

  registerHealthRoutes(app);
  registerEchoRoutes(app, { echo: echoMessage });

  return app;
}

