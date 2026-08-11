import { UpstreamAdapterError, QuotaExhaustedError } from "../../../application/errors.js";

export interface GoogleLatLng {
  latitude?: number;
  longitude?: number;
}

export interface GooglePlaceResource {
  id?: string;
  name?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  primaryType?: string;
  types?: string[];
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  /**
   * Empirically, a websiteless listing may either omit this field or return an
   * empty string. Both shapes mean "no website" and must map to null.
   */
  websiteUri?: string;
  pureServiceAreaBusiness?: boolean;
  location?: GoogleLatLng;
}

export interface NearbySearchResponse {
  places?: GooglePlaceResource[];
}

export interface TextSearchResponse {
  places?: GooglePlaceResource[];
  nextPageToken?: string;
}

export class PlacesAdapterError extends UpstreamAdapterError {
  constructor(
    message: string,
    status: number | null = null,
    options?: { cause?: unknown },
  ) {
    super(message, status, options);
    this.name = "PlacesAdapterError";
  }
}

export class PlacesQuotaError extends QuotaExhaustedError {
  constructor(message: string) {
    super(message);
    this.name = "PlacesQuotaError";
  }
}
