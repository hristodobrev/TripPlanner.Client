import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';

import { TripPlacesComponent } from '../../places/trip-places/trip-places';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog';
import { ShareTripDialogComponent } from '../share-trip-dialog/share-trip-dialog';
import { TripMapComponent } from '../trip-map/trip-map';
import { Trip, TripPermission, TripPlace } from '../trip.models';
import { TripsService } from '../trips.service';

@Component({
  selector: 'app-trip-details',
  imports: [
    DatePipe,
    TripPlacesComponent,
    TripMapComponent,
    MatButtonModule,
    MatIconModule,
    RouterLink,
  ],
  templateUrl: './trip-details.html',
  styleUrl: './trip-details.scss',
})
export class TripDetailsComponent {
  private readonly dialog = inject(MatDialog);
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

    if (!trip) {
      return;
    }

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete trip?',
          message: `Delete ${trip.name}?`,
          confirmLabel: 'Delete trip',
          confirmClass: 'app-danger-button',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
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
      });
  }

  protected updateTripPlaces(places: TripPlace[]) {
    this.trip.update((trip) => (trip ? { ...trip, places } : trip));
  }

  protected addTripPlace(place: TripPlace) {
    this.trip.update((trip) =>
      trip ? { ...trip, places: [...(trip.places ?? []), place] } : trip,
    );
  }

  protected canEditTrip(trip: Trip) {
    return !trip.shared || trip.sharedPermission === TripPermission.Edit;
  }

  protected canShareTrip(trip: Trip) {
    return !trip.shared;
  }

  protected canDeleteTrip(trip: Trip) {
    return !trip.shared;
  }

  protected getSharedPermissionLabel(permission: TripPermission | null | undefined) {
    return permission === TripPermission.Edit ? 'Shared · Edit' : 'Shared · Read only';
  }

  protected openShareDialog() {
    const trip = this.trip();

    if (!trip) {
      return;
    }

    this.dialog.open(ShareTripDialogComponent, {
      data: {
        tripId: trip.id,
        tripName: trip.name,
      },
    });
  }
}
