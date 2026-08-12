import type { HealthStatus } from './health.js';

export interface HealthService {
  healthCheck(): Promise<HealthStatus>;
}
