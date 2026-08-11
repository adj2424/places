import { AGGREGATOR_HOSTS } from "../../config/denylists.js";
import {
  BENIGN_NAMESERVER_HOSTS,
  PARKING_NAMESERVER_HOSTS,
} from "../../config/parking-nameservers.js";
import type { Place } from "../model/place.js";
import type { ProbeEvidence } from "../model/probe-evidence.js";
import type { Classification } from "../model/segment.js";
import { findExclusion, hostMatches, hostOf } from "./exclusions.js";
import {
  isDeadResponse,
  isPoorQuality,
  type QualityThresholds,
} from "./quality.js";

/**
 * Cheapest-first classification ladder. Each rung short-circuits, so a place
 * with no listed URL costs nothing and only a live site reaches the quality bar.
 *
 * Nameserver matching deliberately precedes content inspection: parking pages
 * are commonly served with a success status, so the status code alone would
 * wave them through.
 */
export function classify(
  place: Place,
  evidence: ProbeEvidence | null,
  thresholds: QualityThresholds,
): Classification {
  const exclusion = findExclusion(place);
  if (exclusion !== null) return { kind: "excluded", reason: exclusion };

  if (place.websiteUri === null || place.websiteUri.trim() === "") {
    return { kind: "qualified", segment: "no_website" };
  }

  const host = hostOf(place.websiteUri);
  if (host !== null && hostMatches(host, AGGREGATOR_HOSTS)) {
    return { kind: "qualified", segment: "social_only" };
  }

  // A listed URL nobody managed to check is unknown, never dead.
  if (evidence === null) {
    return {
      kind: "unverified",
      detail: "no probe evidence for a listed URL",
    };
  }

  if (evidence.dns.kind === "transport_failure") {
    return { kind: "unverified", detail: `dns: ${evidence.dns.detail}` };
  }
  if (evidence.dns.kind === "no_record") {
    return { kind: "qualified", segment: "parked_or_dead" };
  }
  if (isParkedNameserver(evidence.dns.nameservers)) {
    return { kind: "qualified", segment: "parked_or_dead" };
  }

  if (evidence.http === null) {
    return {
      kind: "unverified",
      detail: "dns resolved but no fetch was attempted",
    };
  }
  if (evidence.http.kind === "transport_failure") {
    return { kind: "unverified", detail: `http: ${evidence.http.detail}` };
  }

  if (isDeadResponse(evidence.http, thresholds)) {
    return { kind: "qualified", segment: "parked_or_dead" };
  }
  if (isPoorQuality(evidence.http, thresholds)) {
    return { kind: "qualified", segment: "poor_website" };
  }

  return { kind: "not_a_lead" };
}

/**
 * A nameserver only counts as parking when it is not one of the ordinary DNS or
 * site-builder hosts. GoDaddy's `domaincontrol.com` in particular fronts a great
 * many live small-business sites; matching it would discard real customers.
 */
function isParkedNameserver(nameservers: readonly string[]): boolean {
  return nameservers.some((nameserver) => {
    if (hostMatches(nameserver, BENIGN_NAMESERVER_HOSTS)) return false;
    return hostMatches(nameserver, PARKING_NAMESERVER_HOSTS);
  });
}
