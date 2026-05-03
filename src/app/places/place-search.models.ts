export interface PlaceSearchResult {
  id: string;
  externalPlaceId: string;
  name: string;
  photoUrl?: string | null;
  formattedAddress?: string | null;
  locality: string;
  country: string;
  latitude: number;
  longitude: number;
  rating: number;
  websiteUri: string;
  userRatingCount: number;
  primaryTypeDisplayName: string;
}

export interface PlaceDetailsResponse {
  id: string;
  externalId: string;
  photoUrls?: string[] | null;
  formattedAddress: string | null;
  name: string;
  locality: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  websiteUri: string | null;
  userRatingCount: number | null;
  primaryTypeDisplayName: string | null;
  note?: string | null;
  durationMinutes?: number | null;
  plannedTime?: string | null;
}

export interface AccommodationSearchResult {
  externalPlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  userRatingCount: number | null;
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
  status?: number;
}

export interface UpdatePlaceStatusRequest {
  status: number;
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
  status?: number | null;
}
