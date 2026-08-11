import { buildApp } from './composition/build-app.js';
import { loadEnv } from './composition/env.js';
import { createLogger } from './composition/logger.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const app = buildApp({ env, logger });
  await new Promise<void>((resolve, reject) => {
    const server = app.listen(env.PORT, env.HOST, () => {
      logger.info('listening', { host: env.HOST, port: env.PORT });
      resolve();
    });
    server.on('error', reject);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

