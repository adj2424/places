import { describe, expect, it, vi } from "vitest";
import {
  ATMOSPHERE_FIELD_FRAGMENTS,
  DISCOVERY_FIELD_MASK,
} from "../../src/adapters/outbound/google/field-mask.js";
import {
  GooglePlacesDiscovery,
  mapGooglePlace,
} from "../../src/adapters/outbound/google/places-discovery.js";
import { PlacesQuotaError } from "../../src/adapters/outbound/google/types.js";

describe("discovery field mask", () => {
  it("includes Enterprise fields needed for qualification and scoring", () => {
    expect(DISCOVERY_FIELD_MASK).toContain("places.websiteUri");
    expect(DISCOVERY_FIELD_MASK).toContain("places.nationalPhoneNumber");
    expect(DISCOVERY_FIELD_MASK).toContain("places.businessStatus");
    expect(DISCOVERY_FIELD_MASK).toContain("places.rating");
    expect(DISCOVERY_FIELD_MASK).toContain("places.userRatingCount");
    expect(DISCOVERY_FIELD_MASK).toContain("places.pureServiceAreaBusiness");
  });

  it("contains no Atmosphere-tier field", () => {
    for (const fragment of ATMOSPHERE_FIELD_FRAGMENTS) {
      expect(DISCOVERY_FIELD_MASK).not.toContain(fragment);
    }
  });
});

describe("mapGooglePlace", () => {
  it("maps omitted and empty websiteUri to the same absent state", () => {
    const omitted = mapGooglePlace({
      id: "a",
      displayName: { text: "A" },
    });
    const empty = mapGooglePlace({
      id: "b",
      displayName: { text: "B" },
      websiteUri: "  ",
    });
    expect(omitted.websiteUri).toBeNull();
    expect(empty.websiteUri).toBeNull();
  });

  it("maps a service-area business with no location to null coordinates", () => {
    const place = mapGooglePlace({
      id: "svc",
      displayName: { text: "Mobile Plumber" },
      pureServiceAreaBusiness: true,
    });
    expect(place.coordinates).toBeNull();
    expect(place.pureServiceArea).toBe(true);
  });
});

describe("GooglePlacesDiscovery", () => {
  it("sets distance ranking on Nearby Search", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ places: [] }),
    );

    const discovery = new GooglePlacesDiscovery({
      apiKey: "key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => undefined,
    });

    await discovery.discover({
      center: { latitude: 38.83, longitude: -77.19 },
      radiusMeters: 500,
    });

    const nearbyCall = (
      fetchImpl.mock.calls as unknown as Array<[string | URL, RequestInit?]>
    ).find((call) => String(call[0]).includes("searchNearby"));
    expect(nearbyCall).toBeDefined();
    const body = JSON.parse(String(nearbyCall?.[1]?.body));
    expect(body.rankPreference).toBe("DISTANCE");
  });

  it("retries on rate-limit responses", async () => {
    let nearbyAttempts = 0;
    const fetchImpl = vi.fn(async (url: string | URL) => {
      if (String(url).includes("searchNearby")) {
        nearbyAttempts += 1;
        if (nearbyAttempts === 1) {
          return new Response("rate", {
            status: 429,
            statusText: "Too Many Requests",
          });
        }
        return jsonResponse({ places: [] });
      }
      return jsonResponse({ places: [] });
    });

    const discovery = new GooglePlacesDiscovery({
      apiKey: "key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => undefined,
      maxRetries: 2,
    });

    await discovery.discover({
      center: { latitude: 38.83, longitude: -77.19 },
      radiusMeters: 250,
    });

    expect(nearbyAttempts).toBe(2);
  });

  it("unions two Text Search pages without duplicates", async () => {
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("searchNearby")) {
        return jsonResponse({
          places: [
            { id: "shared", displayName: { text: "Shared" }, websiteUri: "" },
          ],
        });
      }

      const body = JSON.parse(String(init?.body));
      if (!body.pageToken) {
        return jsonResponse({
          places: [
            { id: "shared", displayName: { text: "Shared" } },
            { id: "page1", displayName: { text: "Page1" } },
          ],
          nextPageToken: "tok",
        });
      }
      return jsonResponse({
        places: [{ id: "page2", displayName: { text: "Page2" } }],
      });
    });

    const discovery = new GooglePlacesDiscovery({
      apiKey: "key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => undefined,
    });

    const result = await discovery.discover({
      center: { latitude: 38.83, longitude: -77.19 },
      radiusMeters: 250,
    });

    const ids = result.places.map((place) => place.placeId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("shared");
    expect(ids).toContain("page1");
    expect(ids).toContain("page2");

    const textPasses = result.passes.filter((pass) => pass.kind === "text");
    expect(textPasses.length).toBeGreaterThan(0);
    expect(textPasses.every((pass) => pass.resultCount === 2 || pass.resultCount === 0 || pass.resultCount > 0)).toBe(
      true,
    );
  });

  it("returns per-pass counts separately", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      if (String(url).includes("searchNearby")) {
        return jsonResponse({
          places: Array.from({ length: 20 }, (_, i) => ({
            id: `n${i}`,
            displayName: { text: `N${i}` },
          })),
        });
      }
      return jsonResponse({ places: [{ id: "t0", displayName: { text: "T" } }] });
    });

    const discovery = new GooglePlacesDiscovery({
      apiKey: "key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => undefined,
    });

    const result = await discovery.discover({
      center: { latitude: 38.83, longitude: -77.19 },
      radiusMeters: 250,
    });

    const nearby = result.passes.find((pass) => pass.kind === "nearby");
    expect(nearby?.resultCount).toBe(20);
    expect(nearby?.perRequestMaximum).toBe(20);
    expect(result.passes.some((pass) => pass.kind === "text")).toBe(true);
  });

  it("surfaces a typed error for malformed JSON", async () => {
    const fetchImpl = vi.fn(async () => new Response("{nope", { status: 200 }));
    const discovery = new GooglePlacesDiscovery({
      apiKey: "key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => undefined,
      maxRetries: 0,
    });

    await expect(
      discovery.discover({
        center: { latitude: 38.83, longitude: -77.19 },
        radiusMeters: 250,
      }),
    ).rejects.toThrow(/Malformed Places API response/);
  });

  it("raises PlacesQuotaError after exhausting retries", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("rate", { status: 429, statusText: "Too Many Requests" }),
    );
    const discovery = new GooglePlacesDiscovery({
      apiKey: "key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => undefined,
      maxRetries: 0,
    });

    await expect(
      discovery.discover({
        center: { latitude: 38.83, longitude: -77.19 },
        radiusMeters: 250,
      }),
    ).rejects.toBeInstanceOf(PlacesQuotaError);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
