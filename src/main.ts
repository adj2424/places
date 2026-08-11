import { GoogleGeocoder } from "./adapters/outbound/google/geocoder.js";
import { GooglePlacesDiscovery } from "./adapters/outbound/google/places-discovery.js";
import { HttpWebsiteProbe } from "./adapters/outbound/probe/website-probe.js";
import { createSupabaseClient } from "./adapters/outbound/supabase/client.js";
import { SupabaseCoverageRepository } from "./adapters/outbound/supabase/coverage-repository.js";
import { SupabaseLeadRepository } from "./adapters/outbound/supabase/lead-repository.js";
import { buildServer } from "./adapters/inbound/http/server.js";
import { SweepService } from "./application/sweep-service.js";
import { loadConfig } from "./config/index.js";

/**
 * Composition root. Adapters are constructed here and handed to the application
 * service through ports; nothing below the application layer resolves its own
 * dependencies.
 */
async function main(): Promise<void> {
  const config = loadConfig(process.env);

  console.log(
    "Resolved configuration:",
    JSON.stringify(config.describeForLog(), null, 2),
  );

  const supabase = createSupabaseClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
  );

  const sweep = new SweepService({
    config,
    geocoder: new GoogleGeocoder(config.google.apiKey),
    discovery: new GooglePlacesDiscovery({ apiKey: config.google.apiKey }),
    probe: new HttpWebsiteProbe({
      concurrency: config.probe.concurrency,
      timeoutMs: config.probe.timeoutMs,
    }),
    leads: new SupabaseLeadRepository(supabase),
    coverage: new SupabaseCoverageRepository(supabase),
  });

  const server = await buildServer({
    sweep,
    radiusCeilingMeters: config.sweep.radiusCeilingMeters,
  });

  await server.listen({ port: config.server.port, host: "0.0.0.0" });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
