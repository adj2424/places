import { describe, expect, it, vi } from "vitest";
import { createFindPlacesService } from "../../src/application/findplaces.js";
import type { GooglePlacesService } from "../../src/application/ports/google-places-service.js";
import type { PlaceCandidate } from "../../src/domain/findplaces.js";

describe("createFindPlacesService", () => {
  const query = { latitude: 40.7, longitude: -74.0, radiusMeters: 500 };

  it("returns only places with no website", async () => {
    const googlePlacesService: GooglePlacesService = {
      searchNearby: vi.fn(async () => [
        {
          id: "a",
          name: "With site",
          address: "1 A St",
          phone: "111",
          websiteUri: "https://a.com",
        },
        {
          id: "b",
          name: "No site",
          address: "2 B St",
          phone: "222",
          websiteUri: null,
        },
      ] satisfies PlaceCandidate[]),
    };

    const findPlacesService = createFindPlacesService(googlePlacesService);
    const result = await findPlacesService.findPlaces(query);

    expect(result.places).toEqual([
      { id: "b", name: "No site", address: "2 B St", phone: "222" },
    ]);
  });

  it("calls the Google Places service exactly once", async () => {
    const searchNearby = vi.fn(async () => []);
    const googlePlacesService: GooglePlacesService = { searchNearby };

    const findPlacesService = createFindPlacesService(googlePlacesService);
    await findPlacesService.findPlaces(query);

    expect(searchNearby).toHaveBeenCalledTimes(1);
    expect(searchNearby).toHaveBeenCalledWith(query);
  });

  it("returns empty places when every candidate has a website", async () => {
    const googlePlacesService: GooglePlacesService = {
      searchNearby: async () => [
        {
          id: "a",
          name: "A",
          address: null,
          phone: null,
          websiteUri: "https://a.com",
        },
      ],
    };

    const findPlacesService = createFindPlacesService(googlePlacesService);
    await expect(findPlacesService.findPlaces(query)).resolves.toEqual({
      places: [],
    });
  });
});
