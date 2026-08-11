import { normalizeEchoMessage, type EchoResult } from "../domain/echo.js";

export function echoMessage(input: { message: unknown }): EchoResult {
  const message = normalizeEchoMessage(input.message);
  return { message };
}
