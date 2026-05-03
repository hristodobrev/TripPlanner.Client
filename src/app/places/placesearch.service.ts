import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';

import { PlaceAutocompleteOption, PlaceAutocompleteResponse } from './place-autocomplete.models';
import {
  AccommodationSearchResult,
  PlaceDetailsResponse,
  PlaceSearchResult,
} from './place-search.models';

@Injectable({ providedIn: 'root' })
export class PlaceSearchService {
  private readonly http = inject(HttpClient);

  searchAutocomplete(query: string) {
    return this.http
      .get<PlaceAutocompleteResponse[]>(`/api/placesearch/autocomplete/${encodeURIComponent(query)}`)
      .pipe(map((places) => places.map((place) => this.toOption(place))));
  }

  searchPlaces(latitude: number, longitude: number, query: string) {
    const encodedLatitude = encodeURIComponent(latitude.toString());
    const encodedLongitude = encodeURIComponent(longitude.toString());
    const encodedQuery = encodeURIComponent(query);
    return this.http.get<PlaceSearchResult[]>(
      `/api/placesearch/${encodedLatitude}/${encodedLongitude}/${encodedQuery}`,
    );
  }

  getPlace(placeId: string) {
    return this.http.get<PlaceDetailsResponse>(`/api/placesearch/${encodeURIComponent(placeId)}`);
  }

  getAccommodations(latitude: number, longitude: number) {
    const encodedLatitude = encodeURIComponent(latitude.toString());
    const encodedLongitude = encodeURIComponent(longitude.toString());
    return this.http.get<AccommodationSearchResult[]>(
      `/api/placesearch/accommodations/${encodedLatitude}/${encodedLongitude}`,
    );
  }

  private toOption(place: PlaceAutocompleteResponse): PlaceAutocompleteOption {
    return {
      placeId: place.placeId ?? place.PlaceId ?? '',
      mainText: place.mainText ?? place.MainText ?? '',
      secondaryText: place.secondaryText ?? place.SecondaryText ?? '',
    };
  }
}
