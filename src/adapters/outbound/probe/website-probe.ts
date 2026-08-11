import { promises as dnsPromises } from "node:dns";
import {
  BENIGN_NAMESERVER_HOSTS,
  PARKING_NAMESERVER_HOSTS,
} from "../../../config/parking-nameservers.js";
import type { WebsiteProbe } from "../../../application/ports/website-probe.js";
import type { ProbeEvidence } from "../../../domain/model/probe-evidence.js";
import { hostMatches } from "../../../domain/qualification/exclusions.js";
import { lookupDns, type DnsLookup } from "./dns.js";
import { probeHttp, type FetchLike } from "./http-probe.js";

export interface WebsiteProbeOptions {
  readonly concurrency: number;
  readonly timeoutMs: number;
  readonly fetchImpl?: FetchLike;
  readonly dns?: DnsLookup;
}

/**
 * Bounded-concurrency probe. Classification stays in the domain; this adapter
 * only gathers DNS/HTTP signals and an opportunistic email.
 */
export class HttpWebsiteProbe implements WebsiteProbe {
  readonly #concurrency: number;
  readonly #timeoutMs: number;
  readonly #fetch: FetchLike;
  readonly #dns: DnsLookup;
  #active = 0;
  readonly #waiters: Array<() => void> = [];

  constructor(options: WebsiteProbeOptions) {
    this.#concurrency = Math.max(1, options.concurrency);
    this.#timeoutMs = options.timeoutMs;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#dns = options.dns ?? {
      resolveNs: (hostname) => dnsPromises.resolveNs(hostname),
      resolve4: (hostname) => dnsPromises.resolve4(hostname),
      resolve6: (hostname) => dnsPromises.resolve6(hostname),
    };
  }

  async probe(url: string): Promise<ProbeEvidence> {
    await this.#acquire();
    try {
      return await this.#probeUnlocked(url);
    } finally {
      this.#release();
    }
  }

  async #probeUnlocked(url: string): Promise<ProbeEvidence> {
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      return {
        url,
        dns: { kind: "transport_failure", detail: "invalid url" },
        http: null,
        email: null,
      };
    }

    const dns = await lookupDns(hostname, this.#dns);

    if (dns.kind === "no_record" || dns.kind === "transport_failure") {
      return { url, dns, http: null, email: null };
    }

    if (isParkedNameserver(dns.nameservers)) {
      return { url, dns, http: null, email: null };
    }

    const httpResult = await probeHttp(url, {
      fetchImpl: this.#fetch,
      timeoutMs: this.#timeoutMs,
    });

    return {
      url,
      dns,
      http: httpResult.http,
      email: httpResult.email,
    };
  }

  async #acquire(): Promise<void> {
    if (this.#active < this.#concurrency) {
      this.#active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.#waiters.push(resolve));
    this.#active += 1;
  }

  #release(): void {
    this.#active -= 1;
    const next = this.#waiters.shift();
    if (next) next();
  }
}

function isParkedNameserver(nameservers: readonly string[]): boolean {
  return nameservers.some((nameserver) => {
    if (hostMatches(nameserver, BENIGN_NAMESERVER_HOSTS)) return false;
    return hostMatches(nameserver, PARKING_NAMESERVER_HOSTS);
  });
}
