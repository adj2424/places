import { describe, expect, it, vi } from "vitest";
import { buildServer } from "../../src/adapters/inbound/http/server.js";
import { QuotaExhaustedError } from "../../src/application/errors.js";
import {
  SweepAmbiguityError,
  SweepService,
  SweepUnresolvableError,
} from "../../src/application/sweep-service.js";
import { loadConfig } from "../../src/config/index.js";

function config() {
  return loadConfig({
    GOOGLE_MAPS_API_KEY: "g",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "s",
  });
}

describe("POST /sweep", () => {
  it("rejects a radius above the ceiling with zero outbound work", async () => {
    const run = vi.fn();
    const sweep = { run } as unknown as SweepService;
    const app = await buildServer({
      sweep,
      radiusCeilingMeters: config().sweep.radiusCeilingMeters,
    });

    const response = await app.inject({
      method: "POST",
      url: "/sweep",
      payload: {
        latitude: 38.83,
        longitude: -77.19,
        radiusMeters: 9000,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("radius_ceiling");
    expect(run).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects both address and coordinates", async () => {
    const sweep = { run: vi.fn() } as unknown as SweepService;
    const app = await buildServer({
      sweep,
      radiusCeilingMeters: 5000,
    });

    const response = await app.inject({
      method: "POST",
      url: "/sweep",
      payload: {
        address: "Annandale, VA",
        latitude: 38.83,
        longitude: -77.19,
        radiusMeters: 500,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_input");
    await app.close();
  });

  it("rejects neither address nor coordinates", async () => {
    const sweep = { run: vi.fn() } as unknown as SweepService;
    const app = await buildServer({
      sweep,
      radiusCeilingMeters: 5000,
    });

    const response = await app.inject({
      method: "POST",
      url: "/sweep",
      payload: { radiusMeters: 500 },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("rejects a non-positive radius", async () => {
    const sweep = { run: vi.fn() } as unknown as SweepService;
    const app = await buildServer({
      sweep,
      radiusCeilingMeters: 5000,
    });

    const response = await app.inject({
      method: "POST",
      url: "/sweep",
      payload: { latitude: 1, longitude: 2, radiusMeters: 0 },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("returns place IDs from coordinates", async () => {
    const sweep = {
      run: vi.fn(async () => ({
        placeIds: ["a", "b"],
        leads: [],
        incomplete: false,
        cellsQueried: 1,
        cellsSkipped: 0,
      })),
    } as unknown as SweepService;

    const app = await buildServer({ sweep, radiusCeilingMeters: 5000 });
    const response = await app.inject({
      method: "POST",
      url: "/sweep",
      payload: {
        latitude: 38.83,
        longitude: -77.19,
        radiusMeters: 500,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().placeIds).toEqual(["a", "b"]);
    await app.close();
  });

  it("maps ambiguity and unresolvable errors distinctly", async () => {
    const ambiguous = {
      run: vi.fn(async () => {
        throw new SweepAmbiguityError(["One", "Two"]);
      }),
    } as unknown as SweepService;
    const app = await buildServer({
      sweep: ambiguous,
      radiusCeilingMeters: 5000,
    });
    const response = await app.inject({
      method: "POST",
      url: "/sweep",
      payload: { address: "Main St", radiusMeters: 500 },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe("ambiguous_address");
    await app.close();

    const missing = {
      run: vi.fn(async () => {
        throw new SweepUnresolvableError();
      }),
    } as unknown as SweepService;
    const app2 = await buildServer({
      sweep: missing,
      radiusCeilingMeters: 5000,
    });
    const response2 = await app2.inject({
      method: "POST",
      url: "/sweep",
      payload: { address: "Nowhere", radiusMeters: 500 },
    });
    expect(response2.statusCode).toBe(404);
    expect(response2.json().error).toBe("unresolvable_address");
    await app2.close();
  });

  it("maps quota exhaustion to 429", async () => {
    const sweep = {
      run: vi.fn(async () => {
        throw new QuotaExhaustedError("quota");
      }),
    } as unknown as SweepService;
    const app = await buildServer({ sweep, radiusCeilingMeters: 5000 });
    const response = await app.inject({
      method: "POST",
      url: "/sweep",
      payload: { latitude: 1, longitude: 2, radiusMeters: 100 },
    });
    expect(response.statusCode).toBe(429);
    expect(response.json().error).toBe("quota_exhausted");
    await app.close();
  });
});
