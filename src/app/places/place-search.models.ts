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
  externalId: string;
  name: string;
}

export interface UpdatePlaceRequest {
  placeId: string;
  note?: string;
  plannedTime?: string;
  durationMinutes?: number;
}

export interface ReorderPlaceRequest {
  tripId: string;
  sourceId: string;
  targetId: string | null;
  dayNumber: number | null;
}

export interface TripPlaceResponse {
  id: string;
  dayNumber: number | null;
  name: string;
  note: string | null;
  durationMinutes: number | null;
  plannedTime: string | null;
}
