import { buildApp } from './composition/build-app.js';
import { loadConfig } from './composition/config.js';
import { createLogger } from './shared/logging/logger.js';

async function main(): Promise<void> {
  let config;
  let logger;

  try {
    config = loadConfig();
    logger = createLogger(config.log.level);
  } catch (error) {
    createLogger('error').error('load config failed', { error: (error as Error).message });
    process.exit(1);
  }

  const app = buildApp(config, logger);

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(config.server.port, () => {
      logger.info('listening', { port: config.server.port });
      resolve();
    });
    server.on('error', (error: Error) => {
      logger.error('startup failed', { reason: error });
      reject(error);
    });
  });
}

main().catch(() => {
  process.exit(1);
});
