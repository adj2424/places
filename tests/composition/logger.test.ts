import { describe, expect, it, vi } from "vitest";
import { createLogger } from "../../src/composition/logger.js";

describe("createLogger", () => {
  it("emits info when level allows", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    createLogger("info").info("listening", { port: 3000 });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("stays quiet when level is silent", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    createLogger("silent").info("listening", { port: 3000 });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
