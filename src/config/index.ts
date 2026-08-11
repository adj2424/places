export type AppConfig = {
  google: {
    apiKey: string;
  };
  supabase: {
    url: string;
    serviceRoleKey: string;
  };
  sweep: {
    radiusCeilingMeters: number;
    minCellSizeMeters: number;
    requestBudget: number;
    wallClockBudgetMs: number;
  };
  response: {
    cap: number;
    holdoutFraction: number;
  };
  freshness: {
    discoveryDays: number;
    verificationDays: number;
  };
  probe: {
    concurrency: number;
    timeoutMs: number;
  };
  quality: {
    maxResponseMs: number;
    minBodyBytes: number;
  };
  server: {
    port: number;
  };
  describeForLog(): Record<string, unknown>;
};

const DEFAULTS = {
  SWEEP_RADIUS_CEILING_METERS: 5000,
  SWEEP_MIN_CELL_SIZE_METERS: 250,
  SWEEP_REQUEST_BUDGET: 2000,
  SWEEP_WALL_CLOCK_BUDGET_MS: 45_000,
  RESPONSE_CAP: 50,
  RESPONSE_HOLDOUT_FRACTION: 0.15,
  DISCOVERY_FRESHNESS_DAYS: 90,
  VERIFICATION_FRESHNESS_DAYS: 14,
  PROBE_CONCURRENCY: 25,
  PROBE_TIMEOUT_MS: 5000,
  QUALITY_MAX_RESPONSE_MS: 3000,
  QUALITY_MIN_BODY_BYTES: 2048,
  PORT: 3000,
} as const;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function requireString(
  env: Record<string, string | undefined>,
  key: string,
): string {
  const value = env[key];
  if (value === undefined || value.trim() === "") {
    throw new ConfigError(`Missing required environment variable: ${key}`);
  }
  return value;
}

function numberFrom(
  env: Record<string, string | undefined>,
  key: keyof typeof DEFAULTS,
): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") return DEFAULTS[key];
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new ConfigError(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

export function loadConfig(
  env: Record<string, string | undefined>,
): AppConfig {
  const googleApiKey = requireString(env, "GOOGLE_MAPS_API_KEY");
  const supabaseUrl = requireString(env, "SUPABASE_URL");
  const serviceRoleKey = requireString(env, "SUPABASE_SERVICE_ROLE_KEY");

  return {
    google: {
      apiKey: googleApiKey,
    },
    supabase: {
      url: supabaseUrl,
      serviceRoleKey,
    },
    sweep: {
      radiusCeilingMeters: numberFrom(env, "SWEEP_RADIUS_CEILING_METERS"),
      minCellSizeMeters: numberFrom(env, "SWEEP_MIN_CELL_SIZE_METERS"),
      requestBudget: numberFrom(env, "SWEEP_REQUEST_BUDGET"),
      wallClockBudgetMs: numberFrom(env, "SWEEP_WALL_CLOCK_BUDGET_MS"),
    },
    response: {
      cap: numberFrom(env, "RESPONSE_CAP"),
      holdoutFraction: numberFrom(env, "RESPONSE_HOLDOUT_FRACTION"),
    },
    freshness: {
      discoveryDays: numberFrom(env, "DISCOVERY_FRESHNESS_DAYS"),
      verificationDays: numberFrom(env, "VERIFICATION_FRESHNESS_DAYS"),
    },
    probe: {
      concurrency: numberFrom(env, "PROBE_CONCURRENCY"),
      timeoutMs: numberFrom(env, "PROBE_TIMEOUT_MS"),
    },
    quality: {
      maxResponseMs: numberFrom(env, "QUALITY_MAX_RESPONSE_MS"),
      minBodyBytes: numberFrom(env, "QUALITY_MIN_BODY_BYTES"),
    },
    server: {
      port: numberFrom(env, "PORT"),
    },
    describeForLog() {
      return {
        google: { apiKey: "[redacted]" },
        supabase: { url: this.supabase.url, serviceRoleKey: "[redacted]" },
        sweep: this.sweep,
        response: this.response,
        freshness: this.freshness,
        probe: this.probe,
        quality: this.quality,
        server: this.server,
      };
    },
  };
}
