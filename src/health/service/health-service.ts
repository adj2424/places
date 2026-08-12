import type { GooglePlacesHealthAdapter } from '../adapters/google-health.js';
import type { HealthStatus } from '../domain/health.js';
import type { HealthService } from '../domain/port.js';

export class HealthServiceImpl implements HealthService {
  constructor(private readonly googleHealthCheck: GooglePlacesHealthAdapter) {}

  async healthCheck(): Promise<HealthStatus> {
    return await this.googleHealthCheck.healthCheck();
  }
}
