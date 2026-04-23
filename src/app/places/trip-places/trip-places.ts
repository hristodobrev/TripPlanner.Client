import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { finalize } from 'rxjs';

import { PlaceSearchComponent } from '../place-search/place-search';
import { TripPlaceResponse } from '../place-search.models';
import { PlacesService } from '../places.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog';
import { Trip, TripPlace } from '../../trips/trip.models';

interface PlaceDaySection {
  dayNumber: number | null;
  title: string;
  places: TripPlace[];
}

@Component({
  selector: 'app-trip-places',
  imports: [
    PlaceSearchComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTimepickerModule,
  ],
  templateUrl: './trip-places.html',
  styleUrl: './trip-places.scss',
})
export class TripPlacesComponent {
  private readonly dialog = inject(MatDialog);
  private readonly placesService = inject(PlacesService);

  @Input({ required: true }) trip!: Trip;

  @Output() readonly placesChanged = new EventEmitter<TripPlace[]>();

  protected readonly draggedPlaceId = signal<string | null>(null);
  protected readonly deletingPlaceId = signal<string | null>(null);
  protected readonly editingNotePlaceId = signal<string | null>(null);
  protected readonly durationMinutesDraft = signal('');
  protected readonly isReorderingPlaces = signal(false);
  protected readonly message = signal('');
  protected readonly noteDraft = signal('');
  protected readonly plannedTimeDraft = signal<Date | null>(null);
  protected readonly savingNotePlaceId = signal<string | null>(null);

  protected getPlaceDaySections(): PlaceDaySection[] {
    const places = this.trip.places ?? [];
    const sections: PlaceDaySection[] = [
      {
        dayNumber: null,
        title: 'Unscheduled',
        places: this.getPlacesForDay(places, null),
      },
    ];

    for (let dayNumber = 0; dayNumber < this.trip.durationInDays; dayNumber += 1) {
      sections.push({
        dayNumber,
        title: `Day ${dayNumber + 1}`,
        places: this.getPlacesForDay(places, dayNumber),
      });
    }

    return sections;
  }

  protected removePlace(place: TripPlace) {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Remove place?',
          message: `Remove ${place.name} from this trip?`,
          confirmLabel: 'Remove place',
          confirmClass: 'app-danger-button',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.message.set('');
        this.deletingPlaceId.set(place.id);

        this.placesService
          .deletePlace(place.id)
          .pipe(finalize(() => this.deletingPlaceId.set(null)))
          .subscribe({
            next: () => {
              this.placesChanged.emit(
                (this.trip.places ?? []).filter((item) => item.id !== place.id),
              );
              this.message.set('Place removed from this trip.');
            },
            error: () => this.message.set('Could not remove this place. Please try again.'),
          });
      });
  }

  protected startNoteEdit(place: TripPlace) {
    this.message.set('');
    this.editingNotePlaceId.set(place.id);
    this.noteDraft.set(place.note ?? '');
    this.plannedTimeDraft.set(this.toTimeDraftValue(place.plannedTime));
    this.durationMinutesDraft.set(place.durationMinutes?.toString() ?? '');
  }

  protected cancelNoteEdit() {
    this.editingNotePlaceId.set(null);
    this.noteDraft.set('');
    this.plannedTimeDraft.set(null);
    this.durationMinutesDraft.set('');
  }

  protected updateNoteDraft(value: string) {
    this.noteDraft.set(value);
  }

  protected updatePlannedTimeDraft(value: Date | null) {
    this.plannedTimeDraft.set(value);
  }

  protected updateDurationMinutesDraft(value: string) {
    this.durationMinutesDraft.set(value);
  }

  protected savePlaceDetails(place: TripPlace) {
    if (this.hasInvalidPlaceDetails()) {
      this.message.set('Use 15-minute steps for planned time and duration.');
      return;
    }

    const note = this.noteDraft().trim();
    const plannedTime = this.toPlaceRequestTime(this.plannedTimeDraft());
    const durationMinutes = this.toDurationMinutes(this.durationMinutesDraft());

    this.message.set('');
    this.savingNotePlaceId.set(place.id);

    this.placesService
      .updatePlace(place.id, {
        placeId: place.id,
        ...(note ? { note } : {}),
        ...(plannedTime ? { plannedTime } : {}),
        ...(durationMinutes !== null ? { durationMinutes } : {}),
      })
      .pipe(finalize(() => this.savingNotePlaceId.set(null)))
      .subscribe({
        next: () => {
          this.placesChanged.emit(
            (this.trip.places ?? []).map((item) =>
              item.id === place.id
                ? {
                    ...item,
                    note: note || null,
                    plannedTime: plannedTime || null,
                    durationMinutes,
                  }
                : item,
            ),
          );
          this.cancelNoteEdit();
          this.message.set('Place details saved.');
        },
        error: () => this.message.set('Could not save place details. Please try again.'),
      });
  }

  protected startPlaceDrag(event: DragEvent, place: TripPlace) {
    this.draggedPlaceId.set(place.id);
    event.dataTransfer?.setData('text/plain', place.id);
    event.dataTransfer?.setDragImage(event.currentTarget as Element, 16, 16);
  }

  protected allowPlaceDrop(event: DragEvent) {
    event.preventDefault();
  }

  protected dropPlace(event: DragEvent, targetDayNumber: number | null, targetPlace?: TripPlace) {
    event.preventDefault();
    event.stopPropagation();

    const draggedPlaceId = this.draggedPlaceId() || event.dataTransfer?.getData('text/plain');

    if (!draggedPlaceId || draggedPlaceId === targetPlace?.id) {
      this.draggedPlaceId.set(null);
      return;
    }

    const draggedPlace = (this.trip.places ?? []).find((place) => place.id === draggedPlaceId);

    if (!draggedPlace) {
      this.draggedPlaceId.set(null);
      return;
    }

    const sourceSection = this.getPlaceDaySections().find(
      (section) => section.dayNumber === draggedPlace.dayNumber,
    );
    const sourceIndex =
      sourceSection?.places.findIndex((place) => place.id === draggedPlaceId) ?? -1;
    const originalTargetIndex = targetPlace
      ? sourceSection?.places.findIndex((place) => place.id === targetPlace.id) ?? -1
      : -1;

    const nextSections = this.getPlaceDaySections().map((section) => ({
      ...section,
      places: section.places.filter((place) => place.id !== draggedPlaceId),
    }));
    const targetSection = nextSections.find((section) => section.dayNumber === targetDayNumber);

    if (!targetSection) {
      this.draggedPlaceId.set(null);
      return;
    }

    const targetIndex = targetPlace
      ? targetSection.places.findIndex((place) => place.id === targetPlace.id)
      : targetSection.places.length;
    const insertIndex =
      targetPlace &&
      draggedPlace.dayNumber === targetDayNumber &&
      sourceIndex >= 0 &&
      originalTargetIndex >= 0 &&
      sourceIndex < originalTargetIndex
        ? targetIndex + 1
        : targetIndex;

    targetSection.places.splice(insertIndex >= 0 ? insertIndex : targetSection.places.length, 0, {
      ...draggedPlace,
      dayNumber: targetDayNumber,
    });

    this.draggedPlaceId.set(null);
    this.savePlaceOrder(nextSections, {
      dayNumber: targetDayNumber,
      sourceId: draggedPlaceId,
      targetId: targetPlace?.id ?? null,
    });
  }

  protected endPlaceDrag() {
    this.draggedPlaceId.set(null);
  }

  protected addPlaceLocally(place: TripPlace) {
    this.placesChanged.emit([...(this.trip.places ?? []), place]);
  }

  protected trackTripPlace(_: number, place: TripPlace) {
    return place.id;
  }

  protected trackDaySection(_: number, section: PlaceDaySection) {
    return section.dayNumber ?? 'unscheduled';
  }

  protected formatPlannedTime(plannedTime: string | null | undefined) {
    return this.toTimeInputValue(plannedTime);
  }

  protected hasPlaceDetails(place: TripPlace) {
    return Boolean(
      place.plannedTime ||
        (place.durationMinutes !== null && place.durationMinutes !== undefined),
    );
  }

  protected hasInvalidPlaceDetails() {
    return this.isPlannedTimeStepInvalid() || this.isDurationMinutesStepInvalid();
  }

  protected isPlannedTimeStepInvalid() {
    const plannedTime = this.plannedTimeDraft();

    if (!plannedTime) {
      return false;
    }

    return (
      plannedTime.getMinutes() % 15 !== 0 ||
      plannedTime.getSeconds() !== 0 ||
      plannedTime.getMilliseconds() !== 0
    );
  }

  protected isDurationMinutesStepInvalid() {
    const trimmedValue = this.durationMinutesDraft().trim();

    if (!trimmedValue) {
      return false;
    }

    const durationMinutes = Number(trimmedValue);

    return (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 0 ||
      durationMinutes % 15 !== 0
    );
  }

  private getPlacesForDay(places: TripPlace[], dayNumber: number | null) {
    return places
      .filter((place) => place.dayNumber === dayNumber)
      .sort((first, second) => first.order - second.order);
  }

  private savePlaceOrder(
    sections: PlaceDaySection[],
    movedPlace: { dayNumber: number | null; sourceId: string; targetId: string | null },
  ) {
    const previousPlaces = this.trip.places ?? [];
    const nextPlaces = sections.flatMap((section) =>
      section.places.map((place, index) => ({
        ...place,
        dayNumber: section.dayNumber,
        order: index + 1,
      })),
    );

    this.message.set('');
    this.isReorderingPlaces.set(true);
    this.placesChanged.emit(nextPlaces);

    this.placesService
      .reorderPlace({
        tripId: this.trip.id,
        sourceId: movedPlace.sourceId,
        targetId: movedPlace.targetId,
        dayNumber: movedPlace.dayNumber,
      })
      .pipe(finalize(() => this.isReorderingPlaces.set(false)))
      .subscribe({
        next: (places) => {
          this.placesChanged.emit(this.mapReorderedPlaces(places));
          this.message.set('Places reordered.');
        },
        error: () => {
          this.placesChanged.emit(previousPlaces);
          this.message.set('Could not reorder places. Please try again.');
        },
      });
  }

  private mapReorderedPlaces(places: TripPlaceResponse[]) {
    const dayOrderMap = new Map<string, number>();

    return places.map((place) => {
      const dayKey = place.dayNumber?.toString() ?? 'unscheduled';
      const order = (dayOrderMap.get(dayKey) ?? 0) + 1;

      dayOrderMap.set(dayKey, order);

      return {
        id: place.id,
        name: place.name,
        dayNumber: place.dayNumber,
        order,
        note: place.note,
        durationMinutes: place.durationMinutes,
        plannedTime: place.plannedTime,
      };
    });
  }

  protected getExistingPlaceNames() {
    return (this.trip.places ?? []).map((place) => place.name);
  }

  protected getNextUnscheduledOrder() {
    const unscheduledPlaces = (this.trip.places ?? []).filter((place) => place.dayNumber === null);
    return Math.max(0, ...unscheduledPlaces.map((place) => place.order)) + 1;
  }

  private toDurationMinutes(value: string) {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    const durationMinutes = Number(trimmedValue);
    return Number.isFinite(durationMinutes) &&
      durationMinutes >= 0 &&
      durationMinutes % 15 === 0
      ? Math.trunc(durationMinutes)
      : null;
  }

  private toPlaceRequestTime(value: Date | null) {
    if (!value) {
      return null;
    }

    return `${value.getHours().toString().padStart(2, '0')}:${value
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  }

  private toTimeInputValue(value: string | null | undefined) {
    if (!value) {
      return '';
    }

    const timeParts = value.replace('Z', '').split(':');
    return timeParts.length >= 2 ? `${timeParts[0]}:${timeParts[1]}` : '';
  }

  private toTimeDraftValue(value: string | null | undefined) {
    const timeValue = this.toTimeInputValue(value);

    if (!timeValue) {
      return null;
    }

    const [hours, minutes] = timeValue.split(':').map((part) => Number(part));

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }

    const plannedTime = new Date();
    plannedTime.setHours(hours, minutes, 0, 0);
    return plannedTime;
  }
}
