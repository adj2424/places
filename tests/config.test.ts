import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config/index.js";

const validEnv = {
  GOOGLE_MAPS_API_KEY: "test-google-key",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
};

describe("loadConfig", () => {
  it("maps environment variables onto the typed config shape", () => {
    const config = loadConfig(validEnv);

    expect(config.google.apiKey).toBe("test-google-key");
    expect(config.supabase.url).toBe("https://example.supabase.co");
    expect(config.supabase.serviceRoleKey).toBe("test-service-role-key");

    expect(config.sweep.radiusCeilingMeters).toBe(5000);
    expect(config.sweep.minCellSizeMeters).toBe(250);
    expect(config.sweep.requestBudget).toBe(2000);
    expect(config.sweep.wallClockBudgetMs).toBe(45_000);

    expect(config.response.cap).toBe(50);
    expect(config.response.holdoutFraction).toBeCloseTo(0.15);

    expect(config.freshness.discoveryDays).toBe(90);
    expect(config.freshness.verificationDays).toBe(14);

    expect(config.probe.concurrency).toBeGreaterThan(0);
    expect(config.probe.timeoutMs).toBeGreaterThan(0);
  });

  it("throws a named error when the Google API key is absent", () => {
    expect(() =>
      loadConfig({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "key",
      }),
    ).toThrow(ConfigError);
  });

  it("throws a named error when the Supabase URL is absent", () => {
    expect(() =>
      loadConfig({
        GOOGLE_MAPS_API_KEY: "key",
        SUPABASE_SERVICE_ROLE_KEY: "key",
      }),
    ).toThrow(ConfigError);
  });

  it("applies numeric overrides from the environment", () => {
    const config = loadConfig({
      ...validEnv,
      RESPONSE_CAP: "25",
      RESPONSE_HOLDOUT_FRACTION: "0.2",
      PORT: "4000",
    });

    expect(config.response.cap).toBe(25);
    expect(config.response.holdoutFraction).toBeCloseTo(0.2);
    expect(config.server.port).toBe(4000);
  });

  it("redacts secrets when the config is described for logging", () => {
    const described = loadConfig(validEnv).describeForLog();
    const serialized = JSON.stringify(described);

    expect(serialized).not.toContain("test-google-key");
    expect(serialized).not.toContain("test-service-role-key");
    expect(serialized).toContain("example.supabase.co");
  });
});
