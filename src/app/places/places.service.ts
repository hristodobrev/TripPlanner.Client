import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import {
  AddPlaceRequest,
  PlaceDetailsResponse,
  PlaceSearchResult,
  ReorderPlaceRequest,
  TripPlaceResponse,
  UpdatePlaceRequest,
} from './place-search.models';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly http = inject(HttpClient);

  searchPlaces(placeId: string, query: string) {
    const encodedPlaceId = encodeURIComponent(placeId);
    const encodedQuery = encodeURIComponent(query);
    return this.http.get<PlaceSearchResult[]>(`/api/Places/${encodedPlaceId}/${encodedQuery}`);
  }

  getPlace(placeId: string) {
    return this.http.get<PlaceDetailsResponse>(`/api/Places/${encodeURIComponent(placeId)}`);
  }

  addPlace(request: AddPlaceRequest) {
    return this.http.post<string>('/api/places', request);
  }

  deletePlace(placeId: string) {
    return this.http.delete(`/api/places/${encodeURIComponent(placeId)}`);
  }

  updatePlace(placeId: string, request: UpdatePlaceRequest) {
    return this.http.put(`/api/Places/${encodeURIComponent(placeId)}`, request);
  }

  reorderPlace(request: ReorderPlaceRequest) {
    return this.http.put<TripPlaceResponse[]>('/api/Places/reorder', request);
  }
}
