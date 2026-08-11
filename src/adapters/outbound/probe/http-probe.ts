import type { HttpOutcome } from "../../../domain/model/probe-evidence.js";
import { extractEmail } from "./email-extract.js";
import { matchFingerprint } from "./fingerprints.js";

export type FetchLike = typeof fetch;

const MAX_REDIRECTS = 5;

export interface HttpProbeResult {
  readonly http: HttpOutcome;
  readonly email: string | null;
}

export async function probeHttp(
  url: string,
  options: {
    readonly fetchImpl: FetchLike;
    readonly timeoutMs: number;
  },
): Promise<HttpProbeResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    let current = url;
    let response: Response | null = null;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      response = await options.fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "places-lead-finder/0.1 (+internal probe)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) break;
        current = new URL(location, current).toString();
        continue;
      }
      break;
    }

    if (response === null) {
      return {
        http: {
          kind: "transport_failure",
          detail: "no response",
        },
        email: null,
      };
    }

    const body = await response.text();
    const responseTimeMs = Date.now() - started;
    const hasMobileViewport =
      /<meta[^>]+name=["']viewport["'][^>]*>/i.test(body) ||
      /<meta[^>]+content=["'][^"']*width\s*=\s*device-width/i.test(body);

    return {
      http: {
        kind: "responded",
        status: response.status,
        finalUrl: current,
        matchedFingerprint: matchFingerprint(body),
        bodyBytes: Buffer.byteLength(body, "utf8"),
        hasMobileViewport,
        responseTimeMs,
      },
      email: extractEmail(body),
    };
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.name === "AbortError"
          ? "timeout"
          : error.message
        : String(error);
    return {
      http: { kind: "transport_failure", detail },
      email: null,
    };
  } finally {
    clearTimeout(timer);
  }
}
