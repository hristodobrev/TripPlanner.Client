import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';

import { TripPlacesComponent } from '../../places/trip-places/trip-places';
import { Trip, TripPlace } from '../trip.models';
import { TripsService } from '../trips.service';

@Component({
  selector: 'app-trip-details',
  imports: [DatePipe, RouterLink, TripPlacesComponent],
  templateUrl: './trip-details.html',
  styleUrl: './trip-details.scss',
})
export class TripDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripsService = inject(TripsService);

  protected readonly isLoadingTrip = signal(true);
  protected readonly trip = signal<Trip | null>(null);
  protected readonly tripError = signal('');
  protected readonly deletingTrip = signal(false);

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.isLoadingTrip.set(true);
          this.tripError.set('');
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

  protected updateTripPlaces(places: TripPlace[]) {
    this.trip.update((trip) => (trip ? { ...trip, places } : trip));
  }
}
