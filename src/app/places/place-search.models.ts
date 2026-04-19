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
  externalPlaceId: string;
  name: string;
}
