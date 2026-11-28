import type { Express } from 'express';
import type { HealthService } from '../domain/port.js';
import type { Logger } from '../../shared/logging/logger.js';

export function registerHealthRoutes(app: Express, healthService: HealthService, logger: Logger): void {
  app.get('/health', async (_req, res) => {
    const result = await healthService.healthCheck();
    const statusCode = result === 'ok' ? 200 : 503;
    logger.info({ status: result }, 'health check result');
    res.status(statusCode).json({ status: result });
  });
}

