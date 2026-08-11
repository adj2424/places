import { describe, expect, it } from "vitest";
import {
  filterPlacesWithNoWebsite,
  hasNoWebsite,
  type PlaceCandidate,
} from "../../src/domain/findplaces.js";

describe("hasNoWebsite", () => {
  it("returns true when website is null", () => {
    expect(hasNoWebsite(null)).toBe(true);
  });

  it("returns true when website is empty string", () => {
    expect(hasNoWebsite("")).toBe(true);
  });

  it("returns false when website is present", () => {
    expect(hasNoWebsite("https://example.com")).toBe(false);
  });
});

describe("filterPlacesWithNoWebsite", () => {
  const candidate = (
    overrides: Partial<PlaceCandidate> = {},
  ): PlaceCandidate => ({
    id: "place-1",
    name: "Example",
    address: "1 Main St",
    phone: "555-0100",
    websiteUri: null,
    ...overrides,
  });

  it("excludes places with a website", () => {
    const results = filterPlacesWithNoWebsite([
      candidate({ id: "a", websiteUri: "https://a.com" }),
      candidate({ id: "b", websiteUri: null }),
    ]);

    expect(results).toEqual([
      { id: "b", name: "Example", address: "1 Main St", phone: "555-0100" },
    ]);
  });

  it("keeps places with no website and no phone", () => {
    const results = filterPlacesWithNoWebsite([
      candidate({ id: "c", phone: null, websiteUri: null }),
    ]);

    expect(results).toEqual([
      { id: "c", name: "Example", address: "1 Main St", phone: null },
    ]);
  });
});
