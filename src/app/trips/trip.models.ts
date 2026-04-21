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
  name: string;
  order: number;
  dayNumber: number | null;
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
