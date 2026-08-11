import { describe, expect, it } from "vitest";
import { classify } from "../../src/domain/qualification/segment.js";
import type { Place } from "../../src/domain/model/place.js";
import type { ProbeEvidence } from "../../src/application/ports/website-probe.js";

const THRESHOLDS = { maxResponseMs: 3000, minBodyBytes: 2048 };

function place(overrides: Partial<Place> = {}): Place {
  return {
    placeId: "ChIJtest",
    displayName: "Joe's Diner",
    formattedAddress: "123 Main St, Annandale, VA",
    nationalPhoneNumber: "(703) 555-0100",
    primaryType: "restaurant",
    types: ["restaurant", "food", "point_of_interest", "establishment"],
    businessStatus: "OPERATIONAL",
    rating: 4.4,
    userRatingCount: 62,
    websiteUri: null,
    pureServiceArea: false,
    coordinates: { latitude: 38.83, longitude: -77.19 },
    brandId: null,
    ...overrides,
  };
}

function liveEvidence(overrides: Partial<ProbeEvidence> = {}): ProbeEvidence {
  return {
    url: "https://joesdiner.com",
    dns: { kind: "resolved", nameservers: ["ns1.cloudflare.com"] },
    http: {
      kind: "responded",
      status: 200,
      finalUrl: "https://joesdiner.com/",
      matchedFingerprint: null,
      bodyBytes: 48_000,
      hasMobileViewport: true,
      responseTimeMs: 420,
    },
    email: null,
    ...overrides,
  };
}

describe("classify — exclusions run before any segment", () => {
  it("excludes a place carrying a brand identifier as a chain", () => {
    const result = classify(
      place({ brandId: "brand/subway", websiteUri: null }),
      null,
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "excluded", reason: "chain" });
  });

  it("excludes a permanently closed business", () => {
    const result = classify(
      place({ businessStatus: "CLOSED_PERMANENTLY" }),
      null,
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "excluded", reason: "closed" });
  });

  it("does not exclude a temporarily closed business", () => {
    const result = classify(
      place({ businessStatus: "CLOSED_TEMPORARILY" }),
      null,
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "qualified", segment: "no_website" });
  });

  it("excludes a transit stop as a non-business", () => {
    const result = classify(
      place({ primaryType: "bus_stop", types: ["bus_stop", "point_of_interest"] }),
      null,
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "excluded", reason: "non_business" });
  });

  it("excludes a Catholic parish as centrally supplied but not a Baptist church", () => {
    const parish = classify(
      place({
        displayName: "St. Michael Catholic Church",
        primaryType: "church",
        types: ["church", "place_of_worship"],
      }),
      null,
      THRESHOLDS,
    );
    expect(parish).toEqual({ kind: "excluded", reason: "parent_supplied" });

    const baptist = classify(
      place({
        displayName: "First Baptist Church of Annandale",
        primaryType: "church",
        types: ["church", "place_of_worship"],
      }),
      null,
      THRESHOLDS,
    );
    expect(baptist).toEqual({ kind: "qualified", segment: "no_website" });
  });

  it("excludes a place whose listed site is on a diocesan host", () => {
    const result = classify(
      place({
        displayName: "Holy Trinity Church",
        websiteUri: "https://holytrinity.ecatholic.com",
        primaryType: "church",
        types: ["church", "place_of_worship"],
      }),
      liveEvidence({ url: "https://holytrinity.ecatholic.com" }),
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "excluded", reason: "parent_supplied" });
  });
});

describe("classify — the segment ladder", () => {
  it("classifies a place with no website URL as no_website", () => {
    expect(classify(place({ websiteUri: null }), null, THRESHOLDS)).toEqual({
      kind: "qualified",
      segment: "no_website",
    });
  });

  it("classifies an Instagram URL as social_only rather than having a website", () => {
    const result = classify(
      place({ websiteUri: "https://instagram.com/joesdiner" }),
      null,
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "qualified", segment: "social_only" });
  });

  it("classifies a link-aggregator URL as social_only", () => {
    const result = classify(
      place({ websiteUri: "https://linktr.ee/joesdiner" }),
      null,
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "qualified", segment: "social_only" });
  });

  it("classifies a surviving business.site URL as social_only", () => {
    const result = classify(
      place({ websiteUri: "https://joes-diner.business.site" }),
      null,
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "qualified", segment: "social_only" });
  });

  it("classifies parking-provider nameservers as parked_or_dead", () => {
    const result = classify(
      place({ websiteUri: "https://joesdiner.com" }),
      liveEvidence({
        dns: { kind: "resolved", nameservers: ["ns1.sedoparking.com"] },
      }),
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "qualified", segment: "parked_or_dead" });
  });

  it("classifies a confirmed missing DNS record as parked_or_dead", () => {
    const result = classify(
      place({ websiteUri: "https://joesdiner.com" }),
      { url: "https://joesdiner.com", dns: { kind: "no_record" }, http: null, email: null },
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "qualified", segment: "parked_or_dead" });
  });

  it("does not treat a GoDaddy DNS host as parked", () => {
    const result = classify(
      place({ websiteUri: "https://joesdiner.com" }),
      liveEvidence({
        dns: { kind: "resolved", nameservers: ["ns01.domaincontrol.com"] },
      }),
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "not_a_lead" });
  });

  it("classifies a non-success status as parked_or_dead", () => {
    const result = classify(
      place({ websiteUri: "https://joesdiner.com" }),
      liveEvidence({
        http: {
          kind: "responded",
          status: 404,
          finalUrl: "https://joesdiner.com/",
          matchedFingerprint: null,
          bodyBytes: 900,
          hasMobileViewport: false,
          responseTimeMs: 210,
        },
      }),
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "qualified", segment: "parked_or_dead" });
  });

  it("classifies a success response matching a placeholder fingerprint as parked_or_dead", () => {
    const result = classify(
      place({ websiteUri: "https://joesdiner.com" }),
      liveEvidence({
        http: {
          kind: "responded",
          status: 200,
          finalUrl: "https://joesdiner.com/",
          matchedFingerprint: "account suspended",
          bodyBytes: 5_000,
          hasMobileViewport: true,
          responseTimeMs: 180,
        },
      }),
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "qualified", segment: "parked_or_dead" });
  });

  it("classifies a success response under the body-size floor as parked_or_dead", () => {
    const result = classify(
      place({ websiteUri: "https://joesdiner.com" }),
      liveEvidence({
        http: {
          kind: "responded",
          status: 200,
          finalUrl: "https://joesdiner.com/",
          matchedFingerprint: null,
          bodyBytes: 300,
          hasMobileViewport: true,
          responseTimeMs: 180,
        },
      }),
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "qualified", segment: "parked_or_dead" });
  });

  it("classifies a live site with no mobile viewport as poor_website", () => {
    const result = classify(
      place({ websiteUri: "https://joesdiner.com" }),
      liveEvidence({
        http: {
          kind: "responded",
          status: 200,
          finalUrl: "https://joesdiner.com/",
          matchedFingerprint: null,
          bodyBytes: 40_000,
          hasMobileViewport: false,
          responseTimeMs: 400,
        },
      }),
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "qualified", segment: "poor_website" });
  });

  it("classifies a live site slower than the threshold as poor_website", () => {
    const result = classify(
      place({ websiteUri: "https://joesdiner.com" }),
      liveEvidence({
        http: {
          kind: "responded",
          status: 200,
          finalUrl: "https://joesdiner.com/",
          matchedFingerprint: null,
          bodyBytes: 40_000,
          hasMobileViewport: true,
          responseTimeMs: 9_000,
        },
      }),
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "qualified", segment: "poor_website" });
  });

  it("does not qualify a live, fast, mobile-ready site", () => {
    const result = classify(
      place({ websiteUri: "https://joesdiner.com" }),
      liveEvidence(),
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "not_a_lead" });
  });

  it("assigns only the first matching segment when several conditions hold", () => {
    // Instagram URL *and* parking nameservers: social_only wins on ladder order.
    const result = classify(
      place({ websiteUri: "https://instagram.com/joesdiner" }),
      liveEvidence({
        url: "https://instagram.com/joesdiner",
        dns: { kind: "resolved", nameservers: ["ns1.bodis.com"] },
      }),
      THRESHOLDS,
    );

    expect(result).toEqual({ kind: "qualified", segment: "social_only" });
  });
});

describe("classify — transport failures never look like dead domains", () => {
  it("reports a DNS timeout as unverified, not parked_or_dead", () => {
    const result = classify(
      place({ websiteUri: "https://joesdiner.com" }),
      {
        url: "https://joesdiner.com",
        dns: { kind: "transport_failure", detail: "ETIMEOUT" },
        http: null,
        email: null,
      },
      THRESHOLDS,
    );

    expect(result.kind).toBe("unverified");
    expect(result).not.toEqual({ kind: "qualified", segment: "parked_or_dead" });
  });

  it("reports a TLS failure as unverified", () => {
    const result = classify(
      place({ websiteUri: "https://joesdiner.com" }),
      liveEvidence({
        http: { kind: "transport_failure", detail: "CERT_HAS_EXPIRED" },
      }),
      THRESHOLDS,
    );

    expect(result.kind).toBe("unverified");
  });

  it("reports missing evidence for a listed URL as unverified", () => {
    const result = classify(
      place({ websiteUri: "https://joesdiner.com" }),
      null,
      THRESHOLDS,
    );

    expect(result.kind).toBe("unverified");
  });
});
