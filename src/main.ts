import { buildApp } from "./composition/build-app.js";
import {
  createFindPlacesFromGoogle,
  createGoogleServices,
} from "./composition/google-services.js";
import { loadEnv } from "./composition/env.js";
import { createLogger } from "./composition/logger.js";

async function main(): Promise<void> {
  const env = loadEnv();
  if (!env.GOOGLE_PLACES_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY is required");
  }

  const logger = createLogger(env.LOG_LEVEL);
  const google = createGoogleServices(env);
  const findPlacesService = createFindPlacesFromGoogle(google.places);

  const app = buildApp({ env, logger, findPlacesService });
  await new Promise<void>((resolve, reject) => {
    const server = app.listen(env.PORT, env.HOST, () => {
      logger.info("listening", { host: env.HOST, port: env.PORT });
      resolve();
    });
    server.on("error", reject);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
