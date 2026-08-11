import { describe, expect, it } from "vitest";
import { loadEnv } from "../../src/composition/env.js";

describe("loadEnv", () => {
  it("parses valid env with defaults", () => {
    const env = loadEnv({});
    expect(env.PORT).toBe(3000);
    expect(env.HOST).toBe("127.0.0.1");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("coerces PORT from string", () => {
    const env = loadEnv({ PORT: "8080", HOST: "127.0.0.1", LOG_LEVEL: "warn" });
    expect(env.PORT).toBe(8080);
    expect(env.LOG_LEVEL).toBe("warn");
  });

  it("rejects invalid PORT", () => {
    expect(() => loadEnv({ PORT: "not-a-number" })).toThrow();
  });

  it("rejects non-positive PORT", () => {
    expect(() => loadEnv({ PORT: "0" })).toThrow();
  });
});
