import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import {
  AddTripRequest,
  ShareTripRequest,
  Trip,
  TripRecommendation,
  TripShare,
  UpdateTripShareRequest,
} from './trip.models';

@Injectable({ providedIn: 'root' })
export class TripsService {
  private readonly http = inject(HttpClient);

  addTrip(request: AddTripRequest) {
    return this.http.post<string>('/api/Trips', request);
  }

  getTrips() {
    return this.http.get<Trip[]>('/api/Trips');
  }

  getTripRecommendations() {
    return this.http.get<TripRecommendation[]>('/api/Trips/recommendations');
  }

  getTrip(id: string) {
    return this.http.get<Trip>(`/api/Trips/${encodeURIComponent(id)}`);
  }

  deleteTrip(tripId: string) {
    return this.http.delete(`/api/trips/${encodeURIComponent(tripId)}`);
  }

  shareTrip(tripId: string, request: ShareTripRequest) {
    return this.http.post(`/api/trips/${encodeURIComponent(tripId)}/shares`, request);
  }

  getTripShares(tripId: string) {
    return this.http.get<TripShare[]>(`/api/trips/${encodeURIComponent(tripId)}/shares`);
  }

  updateTripShare(tripId: string, tripShareId: string, request: UpdateTripShareRequest) {
    return this.http.put(
      `/api/trips/${encodeURIComponent(tripId)}/shares/${encodeURIComponent(tripShareId)}`,
      request,
    );
  }

  deleteTripShare(tripId: string, tripShareId: string) {
    return this.http.delete(
      `/api/trips/${encodeURIComponent(tripId)}/shares/${encodeURIComponent(tripShareId)}`,
    );
  }
}
