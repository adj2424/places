import { describe, expect, it, vi } from "vitest";
import { SupabaseLeadRepository } from "../../src/adapters/outbound/supabase/lead-repository.js";
import { SupabaseCoverageRepository } from "../../src/adapters/outbound/supabase/coverage-repository.js";
import type { Lead } from "../../src/domain/model/lead.js";

function lead(id: string): Lead {
  return {
    place: {
      placeId: id,
      displayName: "Biz",
      formattedAddress: "Addr",
      nationalPhoneNumber: null,
      primaryType: "cafe",
      types: ["cafe"],
      businessStatus: "OPERATIONAL",
      rating: 4,
      userRatingCount: 10,
      websiteUri: null,
      pureServiceArea: false,
      brandId: null,
      coordinates: { latitude: 38.83, longitude: -77.19 },
    },
    segment: "no_website",
    exclusionReason: null,
    websiteStatus: "none_listed",
    email: null,
    score: 50,
    breakdown: { factors: [{ name: "base", points: 50 }], total: 50 },
    selectionSource: null,
    verifiedAt: new Date().toISOString(),
  };
}

describe("SupabaseLeadRepository", () => {
  it("batch upserts through a single RPC round trip", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const client = {
      rpc,
      from: vi.fn(),
    };

    const repo = new SupabaseLeadRepository(client as never);
    await repo.upsertMany([lead("a"), lead("b")]);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "upsert_leads_batch",
      expect.objectContaining({
        rows: expect.arrayContaining([
          expect.objectContaining({ place_id: "a" }),
          expect.objectContaining({ place_id: "b" }),
        ]),
      }),
    );
  });

  it("surfaces repository errors as typed failures", async () => {
    const repo = new SupabaseLeadRepository({
      rpc: async () => ({ data: null, error: { message: "boom" } }),
    } as never);

    await expect(repo.upsertMany([lead("a")])).rejects.toThrow(/Lead upsert failed/);
  });

  it("maps normalized-name counts from the RPC", async () => {
    const repo = new SupabaseLeadRepository({
      rpc: async () => ({
        data: [{ normalized_name: "acme", distinct_locations: 3 }],
        error: null,
      }),
    } as never);

    await expect(repo.countNormalizedNames()).resolves.toEqual([
      { normalizedName: "acme", distinctLocations: 3 },
    ]);
  });
});

describe("SupabaseCoverageRepository", () => {
  it("records swept cells in one RPC call", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const repo = new SupabaseCoverageRepository({ rpc } as never);
    await repo.recordSweptCells([
      {
        circle: {
          center: { latitude: 38.83, longitude: -77.19 },
          radiusMeters: 500,
        },
        sweptAt: new Date("2026-01-01T00:00:00Z"),
        incomplete: true,
      },
    ]);

    expect(rpc).toHaveBeenCalledWith("record_swept_cells", {
      rows: [
        {
          center_lon: -77.19,
          center_lat: 38.83,
          radius_meters: 500,
          swept_at: "2026-01-01T00:00:00.000Z",
          incomplete: true,
        },
      ],
    });
  });

  it("returns containment answers from is_circle_fully_covered", async () => {
    const repo = new SupabaseCoverageRepository({
      rpc: async () => ({ data: true, error: null }),
    } as never);

    await expect(
      repo.isFullyCovered(
        {
          center: { latitude: 38.83, longitude: -77.19 },
          radiusMeters: 100,
        },
        new Date("2026-01-01"),
      ),
    ).resolves.toBe(true);
  });
});
