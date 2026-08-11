import { GoogleApiError } from './google-api-error.js';

export type GoogleClientConfig = {
  apiKey: string;
  baseUrl: string;
};

export type GooglePostOptions = {
  fieldMask: string;
  body: unknown;
};

/** Low-level HTTP client for Google APIs (Places today; more endpoints later). */
export class GoogleClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: GoogleClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }

  async post<TResponse>(path: string, options: GooglePostOptions): Promise<TResponse> {
    const url = `${this.baseUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': options.fieldMask
        },
        body: JSON.stringify(options.body)
      });
    } catch {
      throw new GoogleApiError('google api unavailable', 503);
    }

    if (!response.ok) {
      const statusCode = response.status === 429 || response.status >= 500 ? 503 : 502;
      throw new GoogleApiError('google api unavailable', statusCode);
    }

    return (await response.json()) as TResponse;
  }
}

