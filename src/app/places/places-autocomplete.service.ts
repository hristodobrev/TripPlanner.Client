import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';

import { PlaceAutocompleteOption, PlaceAutocompleteResponse } from './place-autocomplete.models';

@Injectable({ providedIn: 'root' })
export class PlacesAutocompleteService {
  private readonly http = inject(HttpClient);

  search(query: string) {
    return this.http
      .get<PlaceAutocompleteResponse[]>(`/api/PlacesAutoComplete/${encodeURIComponent(query)}`)
      .pipe(map((places) => places.map((place) => this.toOption(place))));
  }

  private toOption(place: PlaceAutocompleteResponse): PlaceAutocompleteOption {
    return {
      placeId: place.placeId ?? place.PlaceId ?? '',
      mainText: place.mainText ?? place.MainText ?? '',
      secondaryText: place.secondaryText ?? place.SecondaryText ?? '',
    };
  }
}
