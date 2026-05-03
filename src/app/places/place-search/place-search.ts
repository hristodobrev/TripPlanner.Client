import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';

import { TripPlace } from '../../trips/trip.models';
import { PlaceSearchResult } from '../place-search.models';
import { PlaceSearchService } from '../placesearch.service';
import { PlacesService } from '../places.service';

@Component({
  selector: 'app-place-search',
  imports: [DecimalPipe, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './place-search.html',
  styleUrl: './place-search.scss',
})
export class PlaceSearchComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly placeSearchService = inject(PlaceSearchService);
  private readonly placesService = inject(PlacesService);

  @Input({ required: true }) tripId!: string;
  @Input() destinationLatitude: number | null = null;
  @Input() destinationLongitude: number | null = null;
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

    if (
      this.destinationLatitude === null ||
      this.destinationLongitude === null ||
      !Number.isFinite(this.destinationLatitude) ||
      !Number.isFinite(this.destinationLongitude)
    ) {
      this.searchError.set('This trip does not have destination coordinates for place search.');
      return;
    }

    this.isSearchingPlaces.set(true);
    this.placeSearchService
      .searchPlaces(
        this.destinationLatitude,
        this.destinationLongitude,
        this.searchForm.controls.query.value.trim(),
      )
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
        externalId: place.externalPlaceId,
        name: place.name,
      })
      .pipe(finalize(() => this.addingPlaceExternalId.set(null)))
      .subscribe({
        next: (response) => {
          this.placeAdded.emit({
            id: response,
            externalPlaceId: place.externalPlaceId,
            formattedAddress: place.formattedAddress,
            name: place.name,
            order: this.nextOrder,
            dayNumber: null,
            locality: place.locality,
            country: place.country,
            latitude: place.latitude,
            longitude: place.longitude,
            rating: place.rating,
            websiteUri: place.websiteUri,
            userRatingCount: place.userRatingCount,
            primaryTypeDisplayName: place.primaryTypeDisplayName,
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
