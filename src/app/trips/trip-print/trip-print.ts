import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';

import { PlacesService } from '../../places/places.service';
import { PlaceStatus, Trip, TripPlace } from '../trip.models';
import { TripsService } from '../trips.service';

interface ItineraryDay {
  dayNumber: number;
  date: Date | null;
  places: TripPlace[];
}

@Component({
  selector: 'app-trip-print',
  imports: [DatePipe, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './trip-print.html',
  styleUrl: './trip-print.scss',
})
export class TripPrintComponent {
  private readonly placesService = inject(PlacesService);
  private readonly route = inject(ActivatedRoute);
  private readonly tripsService = inject(TripsService);

  protected readonly isLoadingTrip = signal(true);
  protected readonly trip = signal<Trip | null>(null);
  protected readonly tripError = signal('');
  protected readonly savingStatusPlaceId = signal<string | null>(null);

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
        error: () => this.tripError.set('Could not load this trip guide.'),
      });
  }

  protected printPage() {
    window.print();
  }

  protected getItineraryDays(trip: Trip): ItineraryDay[] {
    return Array.from({ length: trip.durationInDays }, (_, dayNumber) => ({
      dayNumber,
      date: this.getTripDate(trip.startDate, dayNumber),
      places: this.getPlacesForDay(trip.places ?? [], dayNumber),
    }));
  }

  protected getUnscheduledPlaces(trip: Trip) {
    return this.getPlacesForDay(trip.places ?? [], null);
  }

  protected getPlaceMeta(place: TripPlace) {
    return [
      place.plannedTime ? this.formatPlannedTime(place.plannedTime) : '',
      place.durationMinutes !== null && place.durationMinutes !== undefined
        ? `${place.durationMinutes} min`
        : '',
    ].filter(Boolean);
  }

  protected formatPlannedTime(plannedTime: string) {
    const timeParts = plannedTime.replace('Z', '').split(':');
    return timeParts.length >= 2 ? `${timeParts[0]}:${timeParts[1]}` : plannedTime;
  }

  protected getDirectionsUrl(place: TripPlace) {
    const destination = encodeURIComponent(place.name);
    const placeId = place.externalPlaceId
      ? `&destination_place_id=${encodeURIComponent(place.externalPlaceId)}`
      : '';

    return `https://www.google.com/maps/dir/?api=1&destination=${destination}${placeId}`;
  }

  protected cyclePlaceStatus(place: TripPlace) {
    if (this.savingStatusPlaceId() === place.id) {
      return;
    }

    const nextStatus = this.getNextPlaceStatus(place.status ?? PlaceStatus.Planned);
    const previousTrip = this.trip();

    if (!previousTrip) {
      return;
    }

    this.savingStatusPlaceId.set(place.id);
    this.updatePlaceInTrip(place.id, { status: nextStatus });

    this.placesService
      .updatePlaceStatus(place.id, nextStatus)
      .pipe(finalize(() => this.savingStatusPlaceId.set(null)))
      .subscribe({
        error: () => {
          this.trip.set(previousTrip);
        },
      });
  }

  protected getPlaceStatusLabel(status: PlaceStatus | number | null | undefined) {
    switch (status) {
      case PlaceStatus.Visited:
        return 'Visited';
      case PlaceStatus.Skipped:
        return 'Skipped';
      case PlaceStatus.Planned:
      default:
        return 'Planned';
    }
  }

  protected getPlaceStatusIcon(status: PlaceStatus | number | null | undefined) {
    switch (status) {
      case PlaceStatus.Visited:
        return 'check_circle_outline';
      case PlaceStatus.Skipped:
        return 'forward_circle';
      case PlaceStatus.Planned:
      default:
        return 'radio_button_unchecked';
    }
  }

  protected getPlaceStatusClass(status: PlaceStatus | number | null | undefined) {
    switch (status) {
      case PlaceStatus.Visited:
        return 'status-visited';
      case PlaceStatus.Skipped:
        return 'status-skipped';
      case PlaceStatus.Planned:
      default:
        return 'status-planned';
    }
  }

  private getPlacesForDay(places: TripPlace[], dayNumber: number | null) {
    return places
      .filter((place) => place.dayNumber === dayNumber)
      .sort((first, second) => first.order - second.order);
  }

  private getNextPlaceStatus(status: PlaceStatus) {
    switch (status) {
      case PlaceStatus.Planned:
        return PlaceStatus.Visited;
      case PlaceStatus.Visited:
        return PlaceStatus.Skipped;
      case PlaceStatus.Skipped:
      default:
        return PlaceStatus.Planned;
    }
  }

  private updatePlaceInTrip(placeId: string, updates: Partial<TripPlace>) {
    this.trip.update((trip) =>
      trip
        ? {
            ...trip,
            places: (trip.places ?? []).map((place) =>
              place.id === placeId ? { ...place, ...updates } : place,
            ),
          }
        : trip,
    );
  }

  private getTripDate(startDate: string, dayNumber: number) {
    const date = this.parseTripDate(startDate);

    if (!date) {
      return null;
    }

    date.setDate(date.getDate() + dayNumber);
    return date;
  }

  private parseTripDate(value: string) {
    if (!value) {
      return null;
    }

    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }
}
