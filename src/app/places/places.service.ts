import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import {
  AddPlaceRequest,
  ReorderPlaceRequest,
  TripPlaceResponse,
  UpdatePlaceRequest,
  UpdatePlaceStatusRequest,
} from './place-search.models';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly http = inject(HttpClient);

  addPlace(request: AddPlaceRequest) {
    return this.http.post<string>('/api/places', request);
  }

  deletePlace(placeId: string) {
    return this.http.delete(`/api/places/${encodeURIComponent(placeId)}`);
  }

  updatePlaceStatus(placeId: string, status: number) {
    const request: UpdatePlaceStatusRequest = { status };
    return this.http.patch(`/api/places/${encodeURIComponent(placeId)}/status`, request);
  }

  updatePlace(placeId: string, request: UpdatePlaceRequest) {
    return this.http.put(`/api/places/${encodeURIComponent(placeId)}`, request);
  }

  reorderPlace(request: ReorderPlaceRequest) {
    return this.http.put<TripPlaceResponse[]>('/api/places/reorder', request);
  }
}
