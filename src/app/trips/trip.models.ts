export interface AddTripRequest {
  name: string;
  description: string;
  placeId: string;
  placeName: string;
  startDate: string;
  endDate: string;
}

export interface TripPlace {
  externalId: string;
  name: string;
}

export interface Trip {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  durationInDays: number;
  destinationExternalId: string;
  externalPlaceId?: string;
  places?: TripPlace[];
  createdAtUtc: string;
}
