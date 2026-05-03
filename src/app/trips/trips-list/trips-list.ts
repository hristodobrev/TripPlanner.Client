import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog';
import { Trip } from '../trip.models';
import { TripsService } from '../trips.service';

@Component({
  selector: 'app-trips-list',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './trips-list.html',
  styleUrl: './trips-list.scss',
})
export class TripsListComponent {
  private readonly dialog = inject(MatDialog);
  private readonly tripsService = inject(TripsService);

  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly deletingTripId = signal<string | null>(null);
  protected readonly trips = signal<Trip[]>([]);

  constructor() {
    this.loadTrips();
  }

  protected loadTrips() {
    this.errorMessage.set('');
    this.isLoading.set(true);

    this.tripsService
      .getTrips()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (trips) => this.trips.set(trips),
        error: () => this.errorMessage.set('Could not load your trips. Please try again.'),
      });
  }

  protected trackTrip(_: number, trip: Trip) {
    return trip.id;
  }

  protected deleteTrip(trip: Trip) {
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

        this.errorMessage.set('');
        this.deletingTripId.set(trip.id);

        this.tripsService
          .deleteTrip(trip.id)
          .pipe(finalize(() => this.deletingTripId.set(null)))
          .subscribe({
            next: () => this.trips.update((trips) => trips.filter((item) => item.id !== trip.id)),
            error: () => this.errorMessage.set('Could not delete this trip. Please try again.'),
          });
      });
  }
}
