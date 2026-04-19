import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';

import { PlaceSearchResult } from '../../places/place-search.models';
import { PlacesService } from '../../places/places.service';
import { Trip, TripPlace } from '../trip.models';
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
  private readonly router = inject(Router);
  private readonly tripsService = inject(TripsService);

  protected readonly isLoadingTrip = signal(true);
  protected readonly isSearchingPlaces = signal(false);
  protected readonly trip = signal<Trip | null>(null);
  protected readonly tripError = signal('');
  protected readonly searchError = signal('');
  protected readonly addPlaceMessage = signal('');
  protected readonly addingPlaceExternalId = signal<string | null>(null);
  protected readonly deletingTrip = signal(false);
  protected readonly deletingPlaceExternalId = signal<string | null>(null);
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
          this.addPlaceMessage.set('');
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

    const destinationExternalId = this.getDestinationExternalId(trip);

    if (!destinationExternalId) {
      this.searchError.set('This trip does not have a destination id for place search.');
      return;
    }

    this.isSearchingPlaces.set(true);
    this.placesService
      .searchPlaces(destinationExternalId, this.searchForm.controls.query.value.trim())
      .pipe(finalize(() => this.isSearchingPlaces.set(false)))
      .subscribe({
        next: (places) => this.places.set(places),
        error: () => this.searchError.set('Could not search places. Please try again.'),
      });
  }

  protected addPlace(place: PlaceSearchResult) {
    const trip = this.trip();

    if (!trip) {
      return;
    }

    this.addPlaceMessage.set('');
    this.addingPlaceExternalId.set(place.externalPlaceId);

    this.placesService
      .addPlace({
        externalPlaceId: place.externalPlaceId,
        name: place.name,
      })
      .pipe(finalize(() => this.addingPlaceExternalId.set(null)))
      .subscribe({
        next: () => {
          this.trip.update((currentTrip) => this.addPlaceLocally(currentTrip, place));
          this.addPlaceMessage.set('Place added to this trip.');
        },
        error: () => this.addPlaceMessage.set('Could not add this place. Please try again.'),
      });
  }

  protected deleteTrip() {
    const trip = this.trip();

    if (!trip || !confirm(`Delete ${trip.name}?`)) {
      return;
    }

    this.tripError.set('');
    this.deletingTrip.set(true);

    this.tripsService
      .deleteTrip(trip.id)
      .pipe(finalize(() => this.deletingTrip.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl('/trips'),
        error: () => this.tripError.set('Could not delete this trip. Please try again.'),
      });
  }

  protected removePlace(place: TripPlace) {
    const trip = this.trip();

    if (!trip || !confirm(`Remove ${place.name} from this trip?`)) {
      return;
    }

    this.addPlaceMessage.set('');
    this.deletingPlaceExternalId.set(place.externalId);

    this.placesService
      .deletePlace(place.externalId)
      .pipe(finalize(() => this.deletingPlaceExternalId.set(null)))
      .subscribe({
        next: () => {
          this.trip.update((currentTrip) => this.removePlaceLocally(currentTrip, place.externalId));
          this.addPlaceMessage.set('Place removed from this trip.');
        },
        error: () => this.addPlaceMessage.set('Could not remove this place. Please try again.'),
      });
  }

  protected isPlaceAdded(place: PlaceSearchResult) {
    return this.trip()?.places?.some((tripPlace) => tripPlace.externalId === place.externalPlaceId);
  }

  protected trackPlace(_: number, place: PlaceSearchResult) {
    return place.externalPlaceId;
  }

  protected trackTripPlace(_: number, place: TripPlace) {
    return place.externalId;
  }

  private getDestinationExternalId(trip: Trip) {
    return trip.destinationExternalId || trip.externalPlaceId || '';
  }

  private addPlaceLocally(trip: Trip | null, place: PlaceSearchResult): Trip | null {
    if (!trip || this.isPlaceAdded(place)) {
      return trip;
    }

    return {
      ...trip,
      places: [
        ...(trip.places ?? []),
        {
          externalId: place.externalPlaceId,
          name: place.name,
        },
      ],
    };
  }

  private removePlaceLocally(trip: Trip | null, externalId: string): Trip | null {
    if (!trip) {
      return trip;
    }

    return {
      ...trip,
      places: (trip.places ?? []).filter((place) => place.externalId !== externalId),
    };
  }
}
