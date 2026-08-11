import { describe, expect, it } from "vitest";
import { echoMessage } from "../../src/application/echo.js";
import { EchoValidationError } from "../../src/domain/echo.js";

describe("echoMessage", () => {
  it("returns the provided message", () => {
    expect(echoMessage({ message: "hi" })).toEqual({ message: "hi" });
  });

  it("rejects empty string", () => {
    expect(() => echoMessage({ message: "" })).toThrow(EchoValidationError);
  });

  it("rejects non-string message", () => {
    expect(() => echoMessage({ message: 42 })).toThrow(EchoValidationError);
  });
});
