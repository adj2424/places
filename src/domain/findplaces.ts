export type PlaceCandidate = {
  id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  websiteUri: string | null;
};

export type PlaceResult = {
  id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
};

/** Keep when website is missing or empty (R5). */
export function hasNoWebsite(websiteUri: string | null | undefined): boolean {
  return websiteUri == null || websiteUri === "";
}

export function filterPlacesWithNoWebsite(
  candidates: PlaceCandidate[],
): PlaceResult[] {
  return candidates
    .filter((place) => hasNoWebsite(place.websiteUri))
    .map(({ id, name, address, phone }) => ({ id, name, address, phone }));
}
