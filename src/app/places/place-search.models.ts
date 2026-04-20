export interface PlaceSearchResult {
  id: string;
  externalPlaceId: string;
  name: string;
  locality: string;
  country: string;
  latitude: number;
  longitude: number;
  rating: number;
  websiteUri: string;
  userRatingCount: number;
  primaryTypeDisplayName: string;
}

export interface AddPlaceRequest {
  tripId: string;
  externalPlaceId: string;
  name: string;
}

export interface UpdatePlaceNoteRequest {
  placeId: string;
  note?: string;
}

export interface ReorderPlacesRequest {
  tripId: string;
  days: ReorderPlacesDayRequest[];
}

export interface ReorderPlacesDayRequest {
  dayNumber: number | null;
  placeIds: string[];
}
