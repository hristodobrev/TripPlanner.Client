import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap, tap } from 'rxjs';

import { PlaceAutocompleteOption } from '../places/place-autocomplete.models';
import { PlaceSearchService } from '../places/placesearch.service';
import { AddTripRequest, TripRecommendation } from '../trips/trip.models';
import { TripsService } from '../trips/trips.service';
import { UserDashboard } from '../users/user.models';
import { UsersService } from '../users/users.service';

@Component({
  selector: 'app-home',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly placeSearchService = inject(PlaceSearchService);
  private readonly router = inject(Router);
  private readonly tripsService = inject(TripsService);
  private readonly usersService = inject(UsersService);

  protected readonly isSearchingPlaces = signal(false);
  protected readonly isSubmittingTrip = signal(false);
  protected readonly isLoadingRecommendations = signal(false);
  protected readonly isLoadingDashboard = signal(false);
  protected readonly formMessage = signal('');
  protected readonly dashboard = signal<UserDashboard>({
    tripsCount: 0,
    visitedPlacesCount: 0,
    plannedPlacesCount: 0,
  });
  protected readonly recommendations = signal<TripRecommendation[]>([]);
  protected readonly placeOptions = signal<PlaceAutocompleteOption[]>([]);
  protected readonly selectedPlace = signal<PlaceAutocompleteOption | null>(null);

  protected readonly tripForm = this.formBuilder.group({
    destination: ['', [Validators.required]],
    startDate: [null as Date | null, [Validators.required]],
    endDate: [null as Date | null, [Validators.required]],
    description: [''],
  });

  constructor() {
    this.loadDashboard();
    this.loadRecommendations();

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
          return this.placeSearchService.searchAutocomplete(trimmedQuery).pipe(
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

  protected trackRecommendation(_: number, recommendation: TripRecommendation) {
    return recommendation.placeId;
  }

  protected useRecommendation(recommendation: TripRecommendation) {
    const place = {
      placeId: recommendation.placeId,
      mainText: recommendation.name,
      secondaryText: recommendation.country,
    };

    this.selectedPlace.set(place);
    this.placeOptions.set([]);
    this.formMessage.set('');
    this.tripForm.patchValue(
      {
        destination: this.formatPlace(place),
        startDate: null,
        endDate: null,
        description: recommendation.description,
      },
      { emitEvent: false },
    );
  }

  private formatPlace(place: PlaceAutocompleteOption) {
    return place.secondaryText ? `${place.mainText}, ${place.secondaryText}` : place.mainText;
  }

  private loadRecommendations() {
    this.isLoadingRecommendations.set(true);
    this.tripsService
      .getTripRecommendations()
      .pipe(
        catchError(() => of([])),
        finalize(() => this.isLoadingRecommendations.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((recommendations) => this.recommendations.set(recommendations));
  }

  private loadDashboard() {
    this.isLoadingDashboard.set(true);
    this.usersService
      .getDashboard()
      .pipe(
        catchError(() => of(this.dashboard())),
        finalize(() => this.isLoadingDashboard.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((dashboard) => this.dashboard.set(dashboard));
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
      destinationName: place.mainText,
      destinationCountry: this.getDestinationCountry(place),
      startDate,
      endDate,
    };
  }

  private getDestinationCountry(place: PlaceAutocompleteOption) {
    const secondaryParts = place.secondaryText
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    return secondaryParts.at(-1) ?? place.secondaryText.trim();
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
