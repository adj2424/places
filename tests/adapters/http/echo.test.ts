import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp } from "../../../src/composition/build-app.js";
import { loadEnv } from "../../../src/composition/env.js";
import { createLogger } from "../../../src/composition/logger.js";

describe("POST /echo", () => {
  function app() {
    const env = loadEnv({ LOG_LEVEL: "silent" });
    return buildApp({ env, logger: createLogger(env.LOG_LEVEL) });
  }

  it("echoes a valid message", async () => {
    const response = await request(app()).post("/echo").send({ message: "hi" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "hi" });
  });

  it("returns 4xx for missing body", async () => {
    const response = await request(app()).post("/echo").send({});
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });

  it("returns 4xx for wrong types", async () => {
    const response = await request(app()).post("/echo").send({ message: 123 });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });

  it("keeps health ok when echo validation fails", async () => {
    const instance = app();
    const bad = await request(instance).post("/echo").send({});
    expect(bad.status).toBeGreaterThanOrEqual(400);

    const health = await request(instance).get("/health");
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: "ok" });
  });
});
