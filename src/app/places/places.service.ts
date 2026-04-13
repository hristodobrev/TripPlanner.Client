import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { PlaceSearchResult } from './place-search.models';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly http = inject(HttpClient);

  searchPlaces(externalPlaceId: string, query: string) {
    const encodedPlaceId = encodeURIComponent(externalPlaceId);
    const encodedQuery = encodeURIComponent(query);
    return this.http.get<PlaceSearchResult[]>(`/api/Places/${encodedPlaceId}/${encodedQuery}`);
  }
}
