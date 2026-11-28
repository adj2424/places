import type { Logger } from '../../shared/logging/logger.js';
import type { HealthStatus } from '../domain/health.js';

export class GooglePlacesHealthAdapter {
  constructor(private readonly logger: Logger) {}
  async healthCheck(): Promise<HealthStatus> {
    const response = await fetch('https://www.google.com', {
      method: 'HEAD'
    });
    if (response.ok) {
      this.logger.info('google api health check passed');
      return 'ok' as HealthStatus;
    }
    this.logger.error('health check failed: google api is not available');
    return 'unhealthy' as HealthStatus;
  }
}
