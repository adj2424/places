import { describe, expect, it, vi } from "vitest";
import { lookupDns } from "../../src/adapters/outbound/probe/dns.js";
import { extractEmail } from "../../src/adapters/outbound/probe/email-extract.js";
import { matchFingerprint } from "../../src/adapters/outbound/probe/fingerprints.js";
import { probeHttp } from "../../src/adapters/outbound/probe/http-probe.js";
import { HttpWebsiteProbe } from "../../src/adapters/outbound/probe/website-probe.js";

describe("dns lookup", () => {
  it("reports NXDOMAIN as a confirmed missing record", async () => {
    const outcome = await lookupDns("missing.example", {
      resolve4: async () => {
        throw Object.assign(new Error("not found"), { code: "ENOTFOUND" });
      },
      resolve6: async () => {
        throw Object.assign(new Error("not found"), { code: "ENOTFOUND" });
      },
      resolveNs: async () => [],
    });
    expect(outcome).toEqual({ kind: "no_record" });
  });

  it("reports timeouts as transport failures", async () => {
    const outcome = await lookupDns("slow.example", {
      resolve4: async () => {
        throw Object.assign(new Error("timeout"), { code: "ETIMEOUT" });
      },
      resolve6: async () => {
        throw Object.assign(new Error("timeout"), { code: "ETIMEOUT" });
      },
      resolveNs: async () => [],
    });
    expect(outcome.kind).toBe("transport_failure");
  });
});

describe("fingerprints and email", () => {
  it("detects placeholder pages", () => {
    expect(matchFingerprint("This domain is parked by GoDaddy")).toBe(
      "godaddy_parked",
    );
  });

  it("extracts mailto emails and ignores missing ones", () => {
    expect(
      extractEmail('<a href="mailto:hello@shop.example">Email</a>'),
    ).toBe("hello@shop.example");
    expect(extractEmail("<p>No contact here</p>")).toBeNull();
  });
});

describe("http probe", () => {
  it("reports viewport absence and response time without deciding a segment", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("<html><body>hello world content here</body></html>", {
          status: 200,
        }),
    );

    const result = await probeHttp("https://example.com", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 1000,
    });

    expect(result.http.kind).toBe("responded");
    if (result.http.kind === "responded") {
      expect(result.http.hasMobileViewport).toBe(false);
      expect(result.http.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.http.responseTimeMs).toBe("number");
    }
  });

  it("reports TLS-like transport failures", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("certificate has expired");
    });
    const result = await probeHttp("https://bad.example", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 1000,
    });
    expect(result.http).toEqual({
      kind: "transport_failure",
      detail: "certificate has expired",
    });
  });
});

describe("HttpWebsiteProbe", () => {
  it("short-circuits parked nameservers without an HTTP fetch", async () => {
    const fetchImpl = vi.fn();
    const probe = new HttpWebsiteProbe({
      concurrency: 2,
      timeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dns: {
        resolve4: async () => ["1.2.3.4"],
        resolve6: async () => [],
        resolveNs: async () => ["ns1.sedoparking.com"],
      },
    });

    const evidence = await probe.probe("https://parked.example");
    expect(evidence.dns.kind).toBe("resolved");
    expect(evidence.http).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not treat benign DNS hosts as parked", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          '<html><head><meta name="viewport" content="width=device-width"></head><body>ok content that is long enough</body></html>',
          { status: 200 },
        ),
    );
    const probe = new HttpWebsiteProbe({
      concurrency: 2,
      timeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dns: {
        resolve4: async () => ["1.2.3.4"],
        resolve6: async () => [],
        resolveNs: async () => ["ns1.domaincontrol.com"],
      },
    });

    const evidence = await probe.probe("https://live.example");
    expect(fetchImpl).toHaveBeenCalled();
    expect(evidence.http?.kind).toBe("responded");
  });

  it("keeps concurrency at or below the configured limit", async () => {
    let active = 0;
    let maxActive = 0;
    const fetchImpl = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      return new Response("<html><body>x</body></html>", { status: 200 });
    });

    const probe = new HttpWebsiteProbe({
      concurrency: 2,
      timeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dns: {
        resolve4: async () => ["1.2.3.4"],
        resolve6: async () => [],
        resolveNs: async () => ["ns.example.com"],
      },
    });

    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        probe.probe(`https://site${i}.example`),
      ),
    );

    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
