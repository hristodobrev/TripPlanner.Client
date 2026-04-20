import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import {
  AddPlaceRequest,
  PlaceSearchResult,
  ReorderPlacesRequest,
  UpdatePlaceNoteRequest,
} from './place-search.models';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly http = inject(HttpClient);

  searchPlaces(placeId: string, query: string) {
    const encodedPlaceId = encodeURIComponent(placeId);
    const encodedQuery = encodeURIComponent(query);
    return this.http.get<PlaceSearchResult[]>(`/api/Places/${encodedPlaceId}/${encodedQuery}`);
  }

  addPlace(request: AddPlaceRequest) {
    return this.http.post<string>('/api/places', request);
  }

  deletePlace(placeId: string) {
    return this.http.delete(`/api/places/${encodeURIComponent(placeId)}`);
  }

  updatePlaceNote(placeId: string, request: UpdatePlaceNoteRequest) {
    return this.http.put(`/api/Places/${encodeURIComponent(placeId)}`, request);
  }

  reorderPlaces(request: ReorderPlacesRequest) {
    return this.http.put('/api/Places/reorder', request);
  }
}
