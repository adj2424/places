export const GOOGLE_ERROR_CODES = {
  INVALID_ARGUMENT: 400,
  UNAUTHENTICATED: 401,
  PERMISSION_DENIED: 403,
  NOT_FOUND: 404,
  RESOURCE_EXHAUSTED: 429,
  GENERIC: 500,
  UNAVAILABLE: 503
} as const;

export class GoogleError extends Error {
  readonly durationMs: number;

  constructor(message: string, durationMs: number) {
    super(message);
    this.name = 'GoogleError';
    this.durationMs = durationMs;
  }
}

export class GoogleInvalidArgumentError extends GoogleError {
  constructor(durationMs: number) {
    super('google invalid argument', durationMs);
  }
}

export class GoogleUnauthenticatedError extends GoogleError {
  constructor(durationMs: number) {
    super('google unauthenticated', durationMs);
  }
}

export class GooglePermissionDeniedError extends GoogleError {
  constructor(durationMs: number) {
    super('google permission denied', durationMs);
  }
}

export class GoogleNotFoundError extends GoogleError {
  constructor(durationMs: number) {
    super('google not found', durationMs);
  }
}

export class GoogleResourceExhaustedError extends GoogleError {
  constructor(durationMs: number) {
    super('google resource exhausted', durationMs);
  }
}

export class GoogleUnavailableError extends GoogleError {
  constructor(durationMs: number) {
    super('google service unavailable', durationMs);
  }
}

export class GoogleGenericError extends GoogleError {
  constructor(durationMs: number) {
    super('google generic error', durationMs);
  }
}

export function mapGoogleHttpStatusToError(status: number, durationMs: number): GoogleError {
  switch (status) {
    case GOOGLE_ERROR_CODES.INVALID_ARGUMENT:
      return new GoogleInvalidArgumentError(durationMs);
    case GOOGLE_ERROR_CODES.UNAUTHENTICATED:
      return new GoogleUnauthenticatedError(durationMs);
    case GOOGLE_ERROR_CODES.PERMISSION_DENIED:
      return new GooglePermissionDeniedError(durationMs);
    case GOOGLE_ERROR_CODES.NOT_FOUND:
      return new GoogleNotFoundError(durationMs);
    case GOOGLE_ERROR_CODES.RESOURCE_EXHAUSTED:
      return new GoogleResourceExhaustedError(durationMs);
    case GOOGLE_ERROR_CODES.UNAVAILABLE:
      return new GoogleUnavailableError(durationMs);
    default:
      return new GoogleGenericError(durationMs);
  }
}

