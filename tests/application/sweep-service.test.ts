import { describe, expect, it, vi } from "vitest";
import type { CoverageRepository } from "../../src/application/ports/coverage-repository.js";
import type { Geocoder } from "../../src/application/ports/geocoder.js";
import type {
  LeadRepository,
  NormalizedNameCount,
} from "../../src/application/ports/lead-repository.js";
import type {
  DiscoveryResult,
  PlaceDiscovery,
} from "../../src/application/ports/place-discovery.js";
import type { WebsiteProbe } from "../../src/application/ports/website-probe.js";
import { selectResults } from "../../src/application/result-selection.js";
import { SweepService } from "../../src/application/sweep-service.js";
import { loadConfig } from "../../src/config/index.js";
import type { Lead } from "../../src/domain/model/lead.js";
import type { Place } from "../../src/domain/model/place.js";
import type { QueryCircle } from "../../src/domain/model/geo.js";

function testConfig() {
  return loadConfig({
    GOOGLE_MAPS_API_KEY: "g",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "s",
    SWEEP_REQUEST_BUDGET: "50",
    SWEEP_WALL_CLOCK_BUDGET_MS: "60000",
    PROBE_CONCURRENCY: "10",
  });
}

function place(id: string, overrides: Partial<Place> = {}): Place {
  return {
    placeId: id,
    displayName: overrides.displayName ?? `Biz ${id}`,
    formattedAddress: "1 Main St",
    nationalPhoneNumber: "555-0100",
    primaryType: "plumber",
    types: ["plumber"],
    businessStatus: "OPERATIONAL",
    rating: 4.5,
    userRatingCount: 40,
    websiteUri: null,
    pureServiceArea: false,
    brandId: null,
    coordinates: { latitude: 38.83, longitude: -77.19 },
    ...overrides,
  };
}

function memoryLeads(): LeadRepository & {
  rows: Map<string, Lead>;
  names: NormalizedNameCount[];
} {
  const rows = new Map<string, Lead>();
  return {
    rows,
    names: [],
    async upsertMany(leads) {
      for (const lead of leads) rows.set(lead.place.placeId, lead);
    },
    async countNormalizedNames() {
      return this.names;
    },
    async findStaleVerifications() {
      return [];
    },
    async findQualifiedWithin() {
      return [];
    },
    async excludeByPlaceId(placeIds, reason) {
      for (const id of placeIds) {
        const existing = rows.get(id);
        if (!existing) continue;
        rows.set(id, {
          ...existing,
          segment: null,
          exclusionReason: reason,
          score: null,
          breakdown: null,
        });
      }
    },
  };
}

function memoryCoverage(
  covered: QueryCircle[] = [],
): CoverageRepository & { recorded: number } {
  return {
    recorded: 0,
    async recordSweptCells(cells) {
      this.recorded += cells.length;
    },
    async isFullyCovered(circle) {
      return covered.some(
        (c) =>
          c.center.latitude === circle.center.latitude &&
          c.center.longitude === circle.center.longitude &&
          c.radiusMeters >= circle.radiusMeters,
      );
    },
    async listFreshCircles() {
      return covered;
    },
  };
}

describe("selectResults", () => {
  it("returns a capped mix with draws from outside the top set", () => {
    const leads: Lead[] = Array.from({ length: 300 }, (_, i) => ({
      place: place(`p${i}`, { userRatingCount: 300 - i }),
      segment: "no_website",
      exclusionReason: null,
      websiteStatus: "none_listed",
      email: null,
      score: 100 - (i % 100),
      breakdown: { factors: [], total: 100 - (i % 100) },
      selectionSource: null,
      verifiedAt: new Date().toISOString(),
    }));

    let seq = 0;
    const selected = selectResults(leads, {
      cap: 50,
      holdoutFraction: 0.15,
      random: () => {
        seq += 0.017;
        return seq % 1;
      },
    });

    expect(selected).toHaveLength(50);
    const draws = selected.filter((lead) => lead.selectionSource === "draw");
    expect(draws.length).toBe(7);
    const rankedIds = new Set(
      selected
        .filter((lead) => lead.selectionSource === "rank")
        .map((lead) => lead.place.placeId),
    );
    for (const draw of draws) {
      expect(rankedIds.has(draw.place.placeId)).toBe(false);
    }
  });
});

describe("SweepService", () => {
  it("issues zero discovery calls when all cells are already covered", async () => {
    const discovery: PlaceDiscovery = {
      discover: vi.fn(async () => ({ places: [], passes: [] })),
    };
    const root: QueryCircle = {
      center: { latitude: 38.83, longitude: -77.19 },
      radiusMeters: 500,
    };
    // Cover with a large circle that contains any child query circle.
    const covered: QueryCircle[] = [
      {
        center: root.center,
        radiusMeters: 5000,
      },
    ];

    const service = new SweepService({
      config: testConfig(),
      geocoder: { resolve: async () => ({ kind: "unresolvable" }) },
      discovery,
      probe: { probe: async () => {
        throw new Error("unused");
      } },
      leads: memoryLeads(),
      coverage: memoryCoverage(covered),
    });

    const result = await service.run({
      origin: { kind: "coordinates", coordinates: root.center },
      radiusMeters: 500,
    });

    expect(discovery.discover).not.toHaveBeenCalled();
    expect(result.cellsQueried).toBe(0);
    expect(result.cellsSkipped).toBeGreaterThan(0);
  });

  it("drives subdivision from per-pass counts, not a merged total", async () => {
    const passCounts: number[][] = [];
    const discovery: PlaceDiscovery = {
      async discover(): Promise<DiscoveryResult> {
        const passes = [
          {
            kind: "nearby" as const,
            query: null,
            resultCount: 20,
            perRequestMaximum: 20,
            requestsIssued: 1,
          },
          {
            kind: "text" as const,
            query: "plumber",
            resultCount: 3,
            perRequestMaximum: 20,
            requestsIssued: 1,
          },
        ];
        passCounts.push(passes.map((pass) => pass.resultCount));
        return {
          places: [place(`id-${passCounts.length}`)],
          passes,
        };
      },
    };

    const service = new SweepService({
      config: {
        ...testConfig(),
        sweep: {
          ...testConfig().sweep,
          requestBudget: 5,
          minCellSizeMeters: 250,
        },
      },
      geocoder: { resolve: async () => ({ kind: "unresolvable" }) },
      discovery,
      probe: {
        probe: async () => ({
          url: "https://x",
          dns: { kind: "no_record" },
          http: null,
          email: null,
        }),
      },
      leads: memoryLeads(),
      coverage: memoryCoverage(),
    });

    await service.run({
      origin: {
        kind: "coordinates",
        coordinates: { latitude: 38.83, longitude: -77.19 },
      },
      radiusMeters: 1000,
    });

    expect(passCounts.length).toBeGreaterThan(0);
    // Nearby saturated alone must subdivide even though text did not.
    expect(passCounts[0]?.[0]).toBe(20);
  });

  it("persists excluded places and omits them from the response", async () => {
    const leads = memoryLeads();
    const discovery: PlaceDiscovery = {
      async discover() {
        return {
          places: [
            place("open", { websiteUri: null }),
            place("closed", {
              businessStatus: "CLOSED_PERMANENTLY",
              websiteUri: null,
            }),
          ],
          passes: [
            {
              kind: "nearby",
              query: null,
              resultCount: 2,
              perRequestMaximum: 20,
              requestsIssued: 1,
            },
          ],
        };
      },
    };

    const service = new SweepService({
      config: testConfig(),
      geocoder: { resolve: async () => ({ kind: "unresolvable" }) },
      discovery,
      probe: {
        probe: async () => ({
          url: "https://x",
          dns: { kind: "no_record" },
          http: null,
          email: null,
        }),
      },
      leads,
      coverage: memoryCoverage(),
    });

    const result = await service.run({
      origin: {
        kind: "coordinates",
        coordinates: { latitude: 38.83, longitude: -77.19 },
      },
      radiusMeters: 250,
    });

    expect(leads.rows.has("closed")).toBe(true);
    expect(leads.rows.get("closed")?.exclusionReason).toBe("closed");
    expect(result.placeIds).toContain("open");
    expect(result.placeIds).not.toContain("closed");
  });

  it("re-verifies stale leads without calling discovery for them", async () => {
    const leads = memoryLeads();
    const stalePlace = place("stale", {
      websiteUri: "https://stale.example",
    });
    leads.findStaleVerifications = async () => [
      {
        place: stalePlace,
        segment: "no_website",
        exclusionReason: null,
        websiteStatus: "none_listed",
        email: null,
        score: 40,
        breakdown: { factors: [], total: 40 },
        selectionSource: null,
        verifiedAt: "2020-01-01T00:00:00.000Z",
        operator: { contactStatus: null, contactedAt: null, notes: null },
        contactSnapshot: null,
      },
    ];

    const discovery: PlaceDiscovery = {
      discover: vi.fn(async () => ({
        places: [],
        passes: [
          {
            kind: "nearby" as const,
            query: null,
            resultCount: 0,
            perRequestMaximum: 20,
            requestsIssued: 1,
          },
        ],
      })),
    };
    const probe: WebsiteProbe = {
      probe: vi.fn(async () => ({
        url: "https://stale.example",
        dns: { kind: "no_record" as const },
        http: null,
        email: null,
      })),
    };

    const service = new SweepService({
      config: testConfig(),
      geocoder: { resolve: async () => ({ kind: "unresolvable" }) },
      discovery,
      probe,
      leads,
      coverage: memoryCoverage([
        {
          center: { latitude: 38.83, longitude: -77.19 },
          radiusMeters: 5000,
        },
      ]),
    });

    await service.run({
      origin: {
        kind: "coordinates",
        coordinates: { latitude: 38.83, longitude: -77.19 },
      },
      radiusMeters: 250,
    });

    expect(discovery.discover).not.toHaveBeenCalled();
    expect(probe.probe).toHaveBeenCalledWith("https://stale.example");
  });

  it("excludes a normalized name appearing three times as a chain", async () => {
    const leads = memoryLeads();

    const discovery: PlaceDiscovery = {
      async discover() {
        return {
          places: [
            place("a1", {
              displayName: "Acme Cleaning",
              coordinates: { latitude: 38.81, longitude: -77.19 },
            }),
            place("a2", {
              displayName: "Acme Cleaning",
              coordinates: { latitude: 38.82, longitude: -77.18 },
            }),
            place("a3", {
              displayName: "Acme Cleaning",
              coordinates: { latitude: 38.83, longitude: -77.17 },
            }),
          ],
          passes: [
            {
              kind: "nearby",
              query: null,
              resultCount: 3,
              perRequestMaximum: 20,
              requestsIssued: 1,
            },
          ],
        };
      },
    };

    const service = new SweepService({
      config: testConfig(),
      geocoder: { resolve: async () => ({ kind: "unresolvable" }) },
      discovery,
      probe: {
        probe: async () => ({
          url: "x",
          dns: { kind: "no_record" },
          http: null,
          email: null,
        }),
      },
      leads,
      coverage: memoryCoverage(),
    });

    const result = await service.run({
      origin: {
        kind: "coordinates",
        coordinates: { latitude: 38.83, longitude: -77.19 },
      },
      radiusMeters: 250,
    });

    expect(result.placeIds).not.toContain("a1");
    expect(leads.rows.get("a1")?.exclusionReason).toBe("chain");
  });

  it("continues when a single probe fails", async () => {
    const discovery: PlaceDiscovery = {
      async discover() {
        return {
          places: [
            place("ok", { websiteUri: null }),
            place("bad", { websiteUri: "https://bad.example" }),
          ],
          passes: [
            {
              kind: "nearby",
              query: null,
              resultCount: 2,
              perRequestMaximum: 20,
              requestsIssued: 1,
            },
          ],
        };
      },
    };

    const service = new SweepService({
      config: testConfig(),
      geocoder: { resolve: async () => ({ kind: "unresolvable" }) },
      discovery,
      probe: {
        probe: async (url) => {
          if (url.includes("bad")) throw new Error("boom");
          return {
            url,
            dns: { kind: "no_record" },
            http: null,
            email: null,
          };
        },
      },
      leads: memoryLeads(),
      coverage: memoryCoverage(),
    });

    const result = await service.run({
      origin: {
        kind: "coordinates",
        coordinates: { latitude: 38.83, longitude: -77.19 },
      },
      radiusMeters: 250,
    });

    expect(result.placeIds).toContain("ok");
    expect(result.placeIds).not.toContain("bad");
  });
});

describe("geocoder wiring through sweep", () => {
  it("resolves an address before sweeping", async () => {
    const geocoder: Geocoder = {
      resolve: vi.fn(async () => ({
        kind: "resolved" as const,
        coordinates: { latitude: 38.83, longitude: -77.19 },
        formattedAddress: "Annandale, VA",
      })),
    };
    const discovery: PlaceDiscovery = {
      discover: vi.fn(async () => ({
        places: [],
        passes: [
          {
            kind: "nearby" as const,
            query: null,
            resultCount: 0,
            perRequestMaximum: 20,
            requestsIssued: 1,
          },
        ],
      })),
    };

    const service = new SweepService({
      config: testConfig(),
      geocoder,
      discovery,
      probe: { probe: async () => {
        throw new Error("unused");
      } },
      leads: memoryLeads(),
      coverage: memoryCoverage(),
    });

    await service.run({
      origin: { kind: "address", address: "Annandale, VA" },
      radiusMeters: 250,
    });

    expect(geocoder.resolve).toHaveBeenCalledWith("Annandale, VA");
    expect(discovery.discover).toHaveBeenCalled();
  });
});
