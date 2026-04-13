import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';

import { PlaceSearchResult } from '../../places/place-search.models';
import { PlacesService } from '../../places/places.service';
import { Trip } from '../trip.models';
import { TripsService } from '../trips.service';

@Component({
  selector: 'app-trip-details',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './trip-details.html',
  styleUrl: './trip-details.scss',
})
export class TripDetailsComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly placesService = inject(PlacesService);
  private readonly route = inject(ActivatedRoute);
  private readonly tripsService = inject(TripsService);

  protected readonly isLoadingTrip = signal(true);
  protected readonly isSearchingPlaces = signal(false);
  protected readonly trip = signal<Trip | null>(null);
  protected readonly tripError = signal('');
  protected readonly searchError = signal('');
  protected readonly places = signal<PlaceSearchResult[]>([]);

  protected readonly searchForm = this.formBuilder.nonNullable.group({
    query: ['', [Validators.required]],
  });

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.isLoadingTrip.set(true);
          this.tripError.set('');
          this.places.set([]);
          return this.tripsService
            .getTrip(params.get('id') ?? '')
            .pipe(finalize(() => this.isLoadingTrip.set(false)));
        }),
      )
      .subscribe({
        next: (trip) => this.trip.set(trip),
        error: () => this.tripError.set('Could not load this trip.'),
      });
  }

  protected searchPlaces() {
    this.searchError.set('');

    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      return;
    }

    const trip = this.trip();

    if (!trip) {
      this.searchError.set('Trip details must load before searching.');
      return;
    }

    this.isSearchingPlaces.set(true);
    this.placesService
      .searchPlaces(trip.externalPlaceId, this.searchForm.controls.query.value.trim())
      .pipe(finalize(() => this.isSearchingPlaces.set(false)))
      .subscribe({
        next: (places) => this.places.set(places),
        error: () => this.searchError.set('Could not search places. Please try again.'),
      });
  }

  protected trackPlace(_: number, place: PlaceSearchResult) {
    return place.externalPlaceId;
  }
}
