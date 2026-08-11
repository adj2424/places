import { describe, expect, it, vi } from "vitest";
import { GoogleClient } from "../../../src/adapters/google/google-client.js";
import {
  GooglePlacesApiService,
  PLACES_NEARBY_FIELD_MASK,
} from "../../../src/adapters/google/google-places-api-service.js";

describe("GooglePlacesApiService", () => {
  it("calls searchNearby through the shared Google client", async () => {
    const post = vi.fn(async () => ({
      places: [
        {
          id: "no-site",
          displayName: { text: "No Site" },
          formattedAddress: "2 B St",
          websiteUri: "",
        },
      ],
    }));

    const client = { post } as unknown as GoogleClient;
    const service = new GooglePlacesApiService(client);

    const results = await service.searchNearby({
      latitude: 40.7,
      longitude: -74.0,
      radiusMeters: 500,
    });

    expect(post).toHaveBeenCalledWith("/places:searchNearby", {
      fieldMask: PLACES_NEARBY_FIELD_MASK,
      body: {
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: 40.7, longitude: -74.0 },
            radius: 500,
          },
        },
      },
    });

    expect(results).toEqual([
      {
        id: "no-site",
        name: "No Site",
        address: "2 B St",
        phone: null,
        websiteUri: "",
      },
    ]);
  });
});
