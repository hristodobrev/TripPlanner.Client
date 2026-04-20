import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { TripPlace } from '../../trips/trip.models';
import { PlaceSearchResult } from '../place-search.models';
import { PlacesService } from '../places.service';

@Component({
  selector: 'app-place-search',
  imports: [DecimalPipe, ReactiveFormsModule],
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
        next: (places) => this.searchResults.set(places),
        error: () => this.searchError.set('Could not search places. Please try again.'),
      });
  }

  protected addPlace(place: PlaceSearchResult) {
    this.message.set('');
    this.addingPlaceExternalId.set(place.externalPlaceId);

    this.placesService
      .addPlace({
        tripId: this.tripId,
        externalPlaceId: place.externalPlaceId,
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
}
