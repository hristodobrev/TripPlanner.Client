import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { AddTripRequest } from './trip.models';

@Injectable({ providedIn: 'root' })
export class TripsService {
  private readonly http = inject(HttpClient);

  addTrip(request: AddTripRequest) {
    return this.http.post('/api/Trips', request);
  }
}
