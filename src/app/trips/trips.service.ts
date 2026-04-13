import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { AddTripRequest, Trip } from './trip.models';

@Injectable({ providedIn: 'root' })
export class TripsService {
  private readonly http = inject(HttpClient);

  addTrip(request: AddTripRequest) {
    return this.http.post('/api/Trips', request);
  }

  getTrips() {
    return this.http.get<Trip[]>('/api/Trips');
  }

  getTrip(id: string) {
    return this.http.get<Trip>(`/api/Trips/${encodeURIComponent(id)}`);
  }
}
