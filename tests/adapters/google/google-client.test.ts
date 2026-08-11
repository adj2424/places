import { describe, expect, it, vi } from "vitest";
import { GoogleApiError } from "../../../src/adapters/google/google-api-error.js";
import { GoogleClient } from "../../../src/adapters/google/google-client.js";

describe("GoogleClient", () => {
  it("posts to a Google API path with api key and field mask", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ places: [] }),
    );

    const client = new GoogleClient({ apiKey: "test-key", fetchImpl });
    await client.post("/places:searchNearby", {
      fieldMask: "places.id",
      body: { maxResultCount: 20 },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places:searchNearby",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": "test-key",
          "X-Goog-FieldMask": "places.id",
        },
        body: JSON.stringify({ maxResultCount: 20 }),
      }),
    );
  });

  it("throws GoogleApiError on non-OK responses", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({}, { status: 403 }),
    );

    const client = new GoogleClient({ apiKey: "test-key", fetchImpl });

    await expect(
      client.post("/places:searchNearby", {
        fieldMask: "places.id",
        body: {},
      }),
    ).rejects.toBeInstanceOf(GoogleApiError);
  });
});
