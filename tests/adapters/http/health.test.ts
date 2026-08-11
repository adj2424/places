import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp } from "../../../src/composition/build-app.js";
import { loadEnv } from "../../../src/composition/env.js";

describe("GET /health", () => {
  it("returns 200 ok", async () => {
    const app = buildApp({
      env: loadEnv({ LOG_LEVEL: "silent" }),
    });
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
