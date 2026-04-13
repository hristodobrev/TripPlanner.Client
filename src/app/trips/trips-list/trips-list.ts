import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { Trip } from '../trip.models';
import { TripsService } from '../trips.service';

@Component({
  selector: 'app-trips-list',
  imports: [DatePipe, RouterLink],
  templateUrl: './trips-list.html',
  styleUrl: './trips-list.scss',
})
export class TripsListComponent {
  private readonly tripsService = inject(TripsService);

  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');
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
}
