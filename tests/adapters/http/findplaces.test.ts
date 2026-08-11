import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { GoogleApiError } from "../../../src/adapters/google/google-api-error.js";
import { buildApp } from "../../../src/composition/build-app.js";
import { loadEnv } from "../../../src/composition/env.js";
import { createLogger } from "../../../src/composition/logger.js";
import type { FindPlacesService } from "../../../src/application/findplaces.js";

describe("POST /find-places", () => {
  function app(findPlacesService: FindPlacesService) {
    const env = loadEnv({ LOG_LEVEL: "silent" });
    return buildApp({
      env,
      logger: createLogger(env.LOG_LEVEL),
      findPlacesService,
    });
  }

  it("returns filtered places for a valid body", async () => {
    const findPlacesService: FindPlacesService = {
      findPlaces: vi.fn(async () => ({
        places: [
          { id: "b", name: "No site", address: "2 B St", phone: "222" },
        ],
      })),
    };

    const response = await request(app(findPlacesService))
      .post("/find-places")
      .send({ latitude: 40.7, longitude: -74.0, radiusMeters: 500 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      places: [
        { id: "b", name: "No site", address: "2 B St", phone: "222" },
      ],
    });
  });

  it("returns 400 for invalid latitude without calling the service", async () => {
    const findPlacesService: FindPlacesService = {
      findPlaces: vi.fn(async () => ({ places: [] })),
    };

    const response = await request(app(findPlacesService))
      .post("/find-places")
      .send({ longitude: -74.0, radiusMeters: 500 });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(findPlacesService.findPlaces).not.toHaveBeenCalled();
  });

  it("returns 200 with an empty places array when nothing matches", async () => {
    const findPlacesService: FindPlacesService = {
      findPlaces: async () => ({ places: [] }),
    };

    const response = await request(app(findPlacesService))
      .post("/find-places")
      .send({ latitude: 40.7, longitude: -74.0, radiusMeters: 500 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ places: [] });
  });

  it("maps upstream failures to opaque 5xx responses", async () => {
    const findPlacesService: FindPlacesService = {
      findPlaces: async () => {
        throw new GoogleApiError("google api unavailable", 503);
      },
    };

    const response = await request(app(findPlacesService))
      .post("/find-places")
      .send({ latitude: 40.7, longitude: -74.0, radiusMeters: 500 });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "places search unavailable" });
  });

  it("keeps health ok when find-places validation fails", async () => {
    const instance = app({ findPlaces: async () => ({ places: [] }) });
    const bad = await request(instance)
      .post("/find-places")
      .send({ latitude: "bad", longitude: -74.0, radiusMeters: 500 });
    expect(bad.status).toBeGreaterThanOrEqual(400);

    const health = await request(instance).get("/health");
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: "ok" });
  });
});
