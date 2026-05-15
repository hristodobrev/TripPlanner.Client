export interface AddTripRequest {
  name: string;
  description: string;
  placeId: string;
  destinationName: string;
  destinationCountry: string;
  startDate: string;
  endDate: string;
}

export enum PlaceStatus {
  Planned = 1,
  Visited = 2,
  Skipped = 3,
}

export enum TripPermission {
  ReadOnly = 1,
  Edit = 2,
}

export interface TripPlace {
  id: string;
  externalPlaceId?: string | null;
  formattedAddress?: string | null;
  name: string;
  order: number;
  dayNumber: number | null;
  locality?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  websiteUri?: string | null;
  userRatingCount?: number | null;
  primaryTypeDisplayName?: string | null;
  note?: string | null;
  durationMinutes?: number | null;
  plannedTime?: string | null;
  status?: PlaceStatus | null;
}

export interface Trip {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  durationInDays: number;
  destinationExternalId: string;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  shared?: boolean;
  sharedPermission?: TripPermission | null;
  places?: TripPlace[];
  createdAtUtc: string;
}

export interface TripRecommendation {
  country: string;
  description: string;
  placeId: string;
  imageAuthor: string;
  imageAuthorUrl: string;
  imageSource: string;
  imageUrl: string;
  name: string;
}

export interface ShareTripRequest {
  userId: string;
  permission: TripPermission;
}

export interface UpdateTripShareRequest {
  permission: TripPermission;
}

export interface TripShare {
  id: string;
  userId: string;
  userFullName: string;
  permission: TripPermission;
}
