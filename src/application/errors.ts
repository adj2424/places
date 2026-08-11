/** Application-visible failures the inbound adapter maps to HTTP statuses. */

export class QuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExhaustedError";
  }
}

export class UpstreamAdapterError extends Error {
  readonly status: number | null;

  constructor(
    message: string,
    status: number | null = null,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "UpstreamAdapterError";
    this.status = status;
  }
}
