import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap, tap } from 'rxjs';

import { PlaceAutocompleteOption } from '../places/place-autocomplete.models';
import { PlacesAutocompleteService } from '../places/places-autocomplete.service';
import { AddTripRequest } from '../trips/trip.models';
import { TripsService } from '../trips/trips.service';

@Component({
  selector: 'app-home',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly placesAutocompleteService = inject(PlacesAutocompleteService);
  private readonly router = inject(Router);
  private readonly tripsService = inject(TripsService);

  protected readonly isSearchingPlaces = signal(false);
  protected readonly isSubmittingTrip = signal(false);
  protected readonly formMessage = signal('');
  protected readonly placeOptions = signal<PlaceAutocompleteOption[]>([]);
  protected readonly selectedPlace = signal<PlaceAutocompleteOption | null>(null);

  protected readonly tripForm = this.formBuilder.group({
    destination: ['', [Validators.required]],
    startDate: [null as Date | null, [Validators.required]],
    endDate: [null as Date | null, [Validators.required]],
    description: [''],
  });

  protected readonly tripIdeas = [
    {
      city: 'Lisbon',
      detail: 'Food walks, viewpoints, and a quick train to Sintra.',
      image:
        'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?auto=format&fit=crop&w=900&q=80',
    },
    {
      city: 'Tokyo',
      detail: 'Neighborhood days, late-night ramen, and flexible transit plans.',
      image:
        'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=900&q=80',
    },
    {
      city: 'Reykjavik',
      detail: 'Hot springs, waterfalls, and weather-aware road trip routes.',
      image:
        'https://images.unsplash.com/photo-1504829857797-ddff29c27927?auto=format&fit=crop&w=900&q=80',
    },
  ];

  constructor() {
    this.tripForm.controls.destination.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap(() => {
          this.selectedPlace.set(null);
        }),
        switchMap((query) => {
          const trimmedQuery = (query ?? '').trim();

          if (trimmedQuery.length < 2) {
            this.isSearchingPlaces.set(false);
            this.placeOptions.set([]);
            return of([]);
          }

          this.isSearchingPlaces.set(true);
          return this.placesAutocompleteService.search(trimmedQuery).pipe(
            catchError(() => of([])),
            finalize(() => this.isSearchingPlaces.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((places) => this.placeOptions.set(places));
  }

  protected selectPlace(place: PlaceAutocompleteOption) {
    this.selectedPlace.set(place);
    this.placeOptions.set([]);
    this.tripForm.controls.destination.setValue(this.formatPlace(place), { emitEvent: false });
  }

  protected submitTrip() {
    this.formMessage.set('');

    if (this.tripForm.invalid || !this.selectedPlace()) {
      this.tripForm.markAllAsTouched();
      this.formMessage.set('Choose a destination from the list and add trip dates.');
      return;
    }

    const request = this.createAddTripRequest(this.selectedPlace());

    if (!request) {
      this.formMessage.set('End date must be the same as or after the start date.');
      return;
    }

    this.isSubmittingTrip.set(true);
    this.tripsService
      .addTrip(request)
      .pipe(finalize(() => this.isSubmittingTrip.set(false)))
      .subscribe({
        next: (tripId) => {
          this.tripForm.reset({
            destination: '',
            startDate: null,
            endDate: null,
            description: '',
          });
          this.selectedPlace.set(null);
          this.placeOptions.set([]);
          void this.router.navigate(['/trips', tripId]);
        },
        error: () => this.formMessage.set('Could not add the trip. Please try again.'),
      });
  }

  protected trackPlace(_: number, place: PlaceAutocompleteOption) {
    return place.placeId;
  }

  private formatPlace(place: PlaceAutocompleteOption) {
    return place.secondaryText ? `${place.mainText}, ${place.secondaryText}` : place.mainText;
  }

  private createAddTripRequest(place: PlaceAutocompleteOption | null): AddTripRequest | null {
    if (!place) {
      return null;
    }

    const formValue = this.tripForm.getRawValue();
    const startDate = this.toUtcIsoDate(formValue.startDate);
    const endDate = this.toUtcIsoDate(formValue.endDate);

    if (!startDate || !endDate || Date.parse(endDate) < Date.parse(startDate)) {
      return null;
    }

    return {
      name: this.formatPlace(place),
      description: (formValue.description ?? '').trim(),
      placeId: place.placeId,
      placeName: place.mainText,
      startDate,
      endDate,
    };
  }

  private toUtcIsoDate(date: Date | null) {
    if (!date) {
      return null;
    }

    return new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0),
    ).toISOString();
  }
}
