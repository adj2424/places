import type { DnsOutcome } from "../../../domain/model/probe-evidence.js";

export type ResolveNs = (hostname: string) => Promise<string[]>;
export type ResolveAddresses = (hostname: string) => Promise<string[]>;

export interface DnsLookup {
  resolveNs: ResolveNs;
  resolve4: ResolveAddresses;
  resolve6: ResolveAddresses;
}

type DnsErrorResult = "no_record" | { readonly failure: string };

/**
 * Resolve address and nameserver records. NXDOMAIN / ENOTFOUND is a confirmed
 * absence; timeouts and SERVFAIL are transport failures.
 */
export async function lookupDns(
  hostname: string,
  dns: DnsLookup,
): Promise<DnsOutcome> {
  try {
    const [v4, v6] = await Promise.all([
      dns.resolve4(hostname).then(
        (): null => null,
        mapDnsError,
      ),
      dns.resolve6(hostname).then(
        (): null => null,
        mapDnsError,
      ),
    ]);

    if (v4 === "no_record" && v6 === "no_record") {
      return { kind: "no_record" };
    }

    const addressResolved = v4 === null || v6 === null;
    if (!addressResolved) {
      if (v4 !== null && typeof v4 === "object") {
        return { kind: "transport_failure", detail: v4.failure };
      }
      if (v6 !== null && typeof v6 === "object") {
        return { kind: "transport_failure", detail: v6.failure };
      }
      return { kind: "no_record" };
    }

    let nameservers: string[] = [];
    try {
      nameservers = await dns.resolveNs(hostname);
    } catch (error) {
      const mapped = mapDnsError(error);
      if (mapped !== "no_record") {
        return { kind: "transport_failure", detail: mapped.failure };
      }
    }

    return { kind: "resolved", nameservers };
  } catch (error) {
    const mapped = mapDnsError(error);
    if (mapped === "no_record") return { kind: "no_record" };
    return { kind: "transport_failure", detail: mapped.failure };
  }
}

function mapDnsError(error: unknown): DnsErrorResult {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (
    code === "ENOTFOUND" ||
    code === "ENODATA" ||
    code === "NXDOMAIN" ||
    code === "errno.ENOTFOUND"
  ) {
    return "no_record";
  }

  const message = error instanceof Error ? error.message : String(error);
  return { failure: `${code || "dns_error"}: ${message}` };
}
