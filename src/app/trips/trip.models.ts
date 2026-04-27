export interface AddTripRequest {
  name: string;
  description: string;
  placeId: string;
  placeName: string;
  startDate: string;
  endDate: string;
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
}

export interface Trip {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  durationInDays: number;
  destinationExternalId: string;
  places?: TripPlace[];
  createdAtUtc: string;
}
