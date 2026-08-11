import type { HttpOutcome } from "../model/probe-evidence.js";

export interface QualityThresholds {
  readonly maxResponseMs: number;
  readonly minBodyBytes: number;
}

/**
 * A responding site that is really dead: a parking page, a suspended-account
 * stub, or an error page. Status alone is not enough — parking providers serve
 * their pages with a success status, which is why the fingerprint and body-size
 * checks sit beside it.
 */
export function isDeadResponse(
  http: HttpOutcome,
  thresholds: QualityThresholds,
): boolean {
  if (http.kind !== "responded") return false;
  if (http.status < 200 || http.status >= 400) return true;
  if (http.matchedFingerprint !== null) return true;
  return http.bodyBytes < thresholds.minBodyBytes;
}

/**
 * A site that works but is poor enough to pitch against. Deliberately crude:
 * no mobile viewport, or slower than the configured bar.
 */
export function isPoorQuality(
  http: HttpOutcome,
  thresholds: QualityThresholds,
): boolean {
  if (http.kind !== "responded") return false;
  if (!http.hasMobileViewport) return true;
  return http.responseTimeMs > thresholds.maxResponseMs;
}
