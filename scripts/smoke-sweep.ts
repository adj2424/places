/**
 * Live smoke against a Northern Virginia address at the radius ceiling.
 * Requires GOOGLE_MAPS_API_KEY and Supabase credentials in `.env`.
 *
 * Usage: npm run smoke -- --address "Annandale, VA" --radius 5000
 */
import { GoogleGeocoder } from "../src/adapters/outbound/google/geocoder.js";
import { GooglePlacesDiscovery } from "../src/adapters/outbound/google/places-discovery.js";
import { HttpWebsiteProbe } from "../src/adapters/outbound/probe/website-probe.js";
import { createSupabaseClient } from "../src/adapters/outbound/supabase/client.js";
import { SupabaseCoverageRepository } from "../src/adapters/outbound/supabase/coverage-repository.js";
import { SupabaseLeadRepository } from "../src/adapters/outbound/supabase/lead-repository.js";
import { SweepService } from "../src/application/sweep-service.js";
import { loadConfig } from "../src/config/index.js";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const address = argValue("--address") ?? "Annandale, VA";
  const radiusMeters = Number(
    argValue("--radius") ?? config.sweep.radiusCeilingMeters,
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

  const started = Date.now();
  const result = await sweep.run({
    origin: { kind: "address", address },
    radiusMeters,
  });
  const elapsedMs = Date.now() - started;

  console.log(
    JSON.stringify(
      {
        address,
        radiusMeters,
        elapsedMs,
        withinBudget: elapsedMs <= config.sweep.wallClockBudgetMs,
        placeIds: result.placeIds,
        incomplete: result.incomplete,
        cellsQueried: result.cellsQueried,
        cellsSkipped: result.cellsSkipped,
      },
      null,
      2,
    ),
  );

  if (elapsedMs > config.sweep.wallClockBudgetMs) {
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
