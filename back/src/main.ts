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
    logger = createLogger('error').error(error as Error, 'load config failed');
    process.exit(1);
  }

  const app = buildApp(config, logger);

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(config.server.port, () => {
      logger.info({ port: config.server.port }, 'listening');
      resolve();
    });
    server.on('error', (error: Error) => {
      logger.error('startup failed');
      reject(error);
    });
  });
}

main().catch(() => {
  process.exit(1);
});
