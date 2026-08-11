export class GoogleApiError extends Error {
  readonly statusCode: 502 | 503;

  constructor(message: string, statusCode: 502 | 503 = 502) {
    super(message);
    this.name = "GoogleApiError";
    this.statusCode = statusCode;
  }
}
