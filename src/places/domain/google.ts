export type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
};

export type GoogleNearbyResponse = {
  places: GooglePlace[];
};

export type SearchQuery = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};
