export type EchoResult = {
  message: string;
};

export class EchoValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "EchoValidationError";
  }
}

/** Domain rule: message must be a non-empty string. */
export function normalizeEchoMessage(message: unknown): string {
  if (typeof message !== "string") {
    throw new EchoValidationError("message must be a string");
  }
  if (message.length === 0) {
    throw new EchoValidationError("message must not be empty");
  }
  return message;
}
