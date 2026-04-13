export interface AddTripRequest {
  name: string;
  description: string;
  placeId: string;
  startDate: string;
  endDate: string;
}

export interface Trip {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  durationInDays: number;
  externalPlaceId: string;
  createdAtUtc: string;
}
