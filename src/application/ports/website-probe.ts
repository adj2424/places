import type { ProbeEvidence } from "../../domain/model/probe-evidence.js";

export type {
  DnsOutcome,
  HttpOutcome,
  ProbeEvidence,
} from "../../domain/model/probe-evidence.js";

/**
 * Gathers evidence about a listed URL and reports signals, never a decision.
 * Keeping classification out of the adapter is what puts all four segment rules
 * inside the domain's branch-coverage gate.
 */
export interface WebsiteProbe {
  probe(url: string): Promise<ProbeEvidence>;
}
