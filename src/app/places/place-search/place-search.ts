import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';

import { TripPlace } from '../../trips/trip.models';
import { PlaceSearchResult } from '../place-search.models';
import { PlacesService } from '../places.service';

@Component({
  selector: 'app-place-search',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './place-search.html',
  styleUrl: './place-search.scss',
})
export class PlaceSearchComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly placesService = inject(PlacesService);

  @Input({ required: true }) tripId!: string;
  @Input({ required: true }) destinationExternalId!: string;
  @Input() existingPlaceNames: string[] = [];
  @Input() nextOrder = 1;

  @Output() readonly placeAdded = new EventEmitter<TripPlace>();

  protected readonly addingPlaceExternalId = signal<string | null>(null);
  protected readonly isSearchingPlaces = signal(false);
  protected readonly message = signal('');
  protected readonly photoIndexes = signal<Record<string, number>>({});
  protected readonly searchError = signal('');
  protected readonly searchResults = signal<PlaceSearchResult[]>([]);

  protected readonly searchForm = this.formBuilder.nonNullable.group({
    query: ['', [Validators.required]],
  });

  protected searchPlaces() {
    this.searchError.set('');

    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      return;
    }

    if (!this.destinationExternalId) {
      this.searchError.set('This trip does not have a destination id for place search.');
      return;
    }

    this.isSearchingPlaces.set(true);
    this.placesService
      .searchPlaces(this.destinationExternalId, this.searchForm.controls.query.value.trim())
      .pipe(finalize(() => this.isSearchingPlaces.set(false)))
      .subscribe({
        next: (places) => {
          this.searchResults.set(places);
          this.photoIndexes.set(
            places.reduce<Record<string, number>>((accumulator, place) => {
              accumulator[place.externalPlaceId] = 0;
              return accumulator;
            }, {}),
          );
        },
        error: () => this.searchError.set('Could not search places. Please try again.'),
      });
  }

  protected addPlace(place: PlaceSearchResult) {
    this.message.set('');
    this.addingPlaceExternalId.set(place.externalPlaceId);

    this.placesService
      .addPlace({
        tripId: this.tripId,
        externalId: place.externalPlaceId,
        name: place.name,
      })
      .pipe(finalize(() => this.addingPlaceExternalId.set(null)))
      .subscribe({
        next: (response) => {
          this.placeAdded.emit({
            id: response,
            name: place.name,
            order: this.nextOrder,
            dayNumber: null,
          });
          this.message.set('Place added to this trip.');
        },
        error: () => this.message.set('Could not add this place. Please try again.'),
      });
  }

  protected isPlaceAdded(place: PlaceSearchResult) {
    return this.existingPlaceNames.includes(place.name);
  }

  protected trackPlace(_: number, place: PlaceSearchResult) {
    return place.externalPlaceId;
  }

  protected getSelectedPhotoUrl(place: PlaceSearchResult) {
    const photoUrls = place.photoUrls ?? [];

    if (photoUrls.length === 0) {
      return null;
    }

    const index = Math.min(this.getSelectedPhotoIndex(place), photoUrls.length - 1);
    return photoUrls[index] ?? null;
  }

  protected getSelectedPhotoIndex(place: PlaceSearchResult) {
    return this.photoIndexes()[place.externalPlaceId] ?? 0;
  }

  protected hasMultiplePhotos(place: PlaceSearchResult) {
    return (place.photoUrls?.length ?? 0) > 1;
  }

  protected showPreviousPhoto(place: PlaceSearchResult) {
    const photoCount = place.photoUrls?.length ?? 0;

    if (photoCount <= 1) {
      return;
    }

    this.photoIndexes.update((indexes) => ({
      ...indexes,
      [place.externalPlaceId]:
        ((indexes[place.externalPlaceId] ?? 0) - 1 + photoCount) % photoCount,
    }));
  }

  protected showNextPhoto(place: PlaceSearchResult) {
    const photoCount = place.photoUrls?.length ?? 0;

    if (photoCount <= 1) {
      return;
    }

    this.photoIndexes.update((indexes) => ({
      ...indexes,
      [place.externalPlaceId]: ((indexes[place.externalPlaceId] ?? 0) + 1) % photoCount,
    }));
  }
}
