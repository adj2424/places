export const GOOGLE_ERROR_CODES = {
  INVALID_ARGUMENT: 400,
  UNAUTHENTICATED: 401,
  PERMISSION_DENIED: 403,
  NOT_FOUND: 404,
  RESOURCE_EXHAUSTED: 429,
  GENERIC: 500,
  UNAVAILABLE: 503
} as const;

export class GooglePlacesError extends Error {
  readonly durationMs: number;
  readonly name: string;
  readonly message: string;

  constructor(message: string, durationMs: number) {
    super();
    this.name = 'GooglePlacesError';
    this.message = message;
    this.durationMs = durationMs;
  }
}

export class InvalidArgumentError extends GooglePlacesError {
  constructor(durationMs: number) {
    super('google invalid argument', durationMs);
  }
}

export class UnauthenticatedError extends GooglePlacesError {
  constructor(durationMs: number) {
    super('google unauthenticated', durationMs);
  }
}

export class PermissionDeniedError extends GooglePlacesError {
  constructor(durationMs: number) {
    super('google permission denied', durationMs);
  }
}

export class NotFoundError extends GooglePlacesError {
  constructor(durationMs: number) {
    super('google request not found', durationMs);
  }
}

export class ResourceExhaustedError extends GooglePlacesError {
  constructor(durationMs: number) {
    super('google resource exhausted', durationMs);
  }
}

export class UnavailableError extends GooglePlacesError {
  constructor(durationMs: number) {
    super('google service unavailable', durationMs);
  }
}

export class GenericError extends GooglePlacesError {
  constructor(durationMs: number) {
    super('google generic error', durationMs);
  }
}

export class GoogleGeocodeError extends Error {
  readonly durationMs: number;
  readonly name: string;
  readonly message: string;

  constructor(message: string, durationMs: number) {
    super();
    this.name = 'GoogleGeocodeError';
    this.message = message;
    this.durationMs = durationMs;
  }
}

export class GeocodeInvalidAddressError extends GoogleGeocodeError {
  constructor(durationMs: number) {
    super('google geocoding invalid address', durationMs);
  }
}

export class GeocodeUnavailableError extends GoogleGeocodeError {
  constructor(durationMs: number) {
    super('google geocoding service unavailable', durationMs);
  }
}

export class GeocodeUnexpectedError extends GoogleGeocodeError {
  constructor(durationMs: number) {
    super('google geocoding unexpected error', durationMs);
  }
}

export class GeocodeInvalidResponseError extends GoogleGeocodeError {
  constructor(durationMs: number) {
    super('google geocoding invalid response', durationMs);
  }
}

export class GeocodeResourceExhaustedError extends GoogleGeocodeError {
  constructor(durationMs: number) {
    super('google geocoding resource exhausted', durationMs);
  }
}

export function mapGoogleHttpStatusToError(status: number, durationMs: number): GooglePlacesError {
  switch (status) {
    case GOOGLE_ERROR_CODES.INVALID_ARGUMENT:
      return new InvalidArgumentError(durationMs);
    case GOOGLE_ERROR_CODES.UNAUTHENTICATED:
      return new UnauthenticatedError(durationMs);
    case GOOGLE_ERROR_CODES.PERMISSION_DENIED:
      return new PermissionDeniedError(durationMs);
    case GOOGLE_ERROR_CODES.NOT_FOUND:
      return new NotFoundError(durationMs);
    case GOOGLE_ERROR_CODES.RESOURCE_EXHAUSTED:
      return new ResourceExhaustedError(durationMs);
    case GOOGLE_ERROR_CODES.UNAVAILABLE:
      return new UnavailableError(durationMs);
    default:
      return new GenericError(durationMs);
  }
}

export type MappedFindPlacesError = {
  status: 400 | 500 | 502;
  body: { error: string };
};

export function mapFindPlacesError(error: unknown): MappedFindPlacesError {
  if (error instanceof GeocodeInvalidAddressError) {
    return { status: 400, body: { error: error.message } };
  }

  if (error instanceof GooglePlacesError) {
    return { status: 502, body: { error: 'google places service unavailable' } };
  }

  if (error instanceof GoogleGeocodeError) {
    return { status: 502, body: { error: 'google geocoding service unavailable' } };
  }

  return { status: 500, body: { error: 'unknown error' } };
}
