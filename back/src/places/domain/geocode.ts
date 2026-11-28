export type GoogleGeocodeStatus =
  | 'OK'
  | 'ZERO_RESULTS'
  | 'OVER_DAILY_LIMIT'
  | 'OVER_QUERY_LIMIT'
  | 'REQUEST_DENIED'
  | 'INVALID_REQUEST'
  | 'UNKNOWN_ERROR';

export type GoogleGeocodeLocationType = 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE';

export type GoogleLatLngBounds = {
  northeast: {
    lat: number;
    lng: number;
  };
  southwest: {
    lat: number;
    lng: number;
  };
};

export type GoogleGeocodeAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type GoogleGeocodeGeometry = {
  location: {
    lat: number;
    lng: number;
  };
  location_type: GoogleGeocodeLocationType;
  viewport: GoogleLatLngBounds;
  bounds?: GoogleLatLngBounds;
};

export type GoogleGeocodeResult = {
  address_components: GoogleGeocodeAddressComponent[];
  formatted_address: string;
  geometry: GoogleGeocodeGeometry;
  place_id: string;
  types: string[];
  plus_code?: {
    global_code: string;
    compound_code?: string;
  };
  partial_match?: boolean;
  postcode_localities?: string[];
};

export type GoogleGeocodeResponse = {
  status: GoogleGeocodeStatus;
  results: GoogleGeocodeResult[];
  error_message?: string;
};
