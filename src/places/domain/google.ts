export type GooglePlace = {
  id: string;
  types?: string[];
  primaryType?: string;
  displayName?: { text: string; languageCode: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
};

export type GooglePlacesResponse = {
  places: GooglePlace[];
};
