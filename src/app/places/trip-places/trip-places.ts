import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
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
    DragDropModule,
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
  protected readonly daySections = signal<PlaceDaySection[]>([]);
  protected readonly editingNotePlaceId = signal<string | null>(null);
  protected readonly durationMinutesDraft = signal('');
  protected readonly isReorderingPlaces = signal(false);
  protected readonly message = signal('');
  protected readonly noteDraft = signal('');
  protected readonly plannedTimeDraft = signal<Date | null>(null);
  protected readonly savingNotePlaceId = signal<string | null>(null);

  ngOnChanges(_: SimpleChanges) {
    const tripPlaces = this.trip?.places ?? [];
    const currentPlaces = this.flattenSections(this.daySections());

    if (
      this.daySections().length !== this.trip.durationInDays + 1 ||
      !this.arePlacesEquivalent(currentPlaces, tripPlaces)
    ) {
      this.daySections.set(this.buildSections(tripPlaces));
    }
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
              const updatedPlaces = this.getCurrentPlaces().filter((item) => item.id !== place.id);
              this.daySections.set(this.buildSections(updatedPlaces));
              this.placesChanged.emit(updatedPlaces);
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
          const updatedPlaces = this.getCurrentPlaces().map((item) =>
            item.id === place.id
              ? {
                  ...item,
                  note: note || null,
                  plannedTime: plannedTime || null,
                  durationMinutes,
                }
              : item,
          );
          this.daySections.set(this.buildSections(updatedPlaces));
          this.placesChanged.emit(updatedPlaces);
          this.cancelNoteEdit();
          this.message.set('Place details saved.');
        },
        error: () => this.message.set('Could not save place details. Please try again.'),
      });
  }

  protected startPlaceDrag(place: TripPlace) {
    this.draggedPlaceId.set(place.id);
  }

  protected dropPlace(event: CdkDragDrop<TripPlace[]>, targetDayNumber: number | null) {
    const draggedPlace = event.item.data as TripPlace | undefined;

    if (
      !draggedPlace ||
      (event.previousContainer === event.container && event.previousIndex === event.currentIndex)
    ) {
      this.draggedPlaceId.set(null);
      return;
    }

    const previousPlaces = this.getCurrentPlaces();
    const currentSections = this.daySections();
    const targetSection = currentSections.find(
      (section) => this.getDaySectionId(section.dayNumber) === event.container.id,
    );

    if (!targetSection) {
      this.draggedPlaceId.set(null);
      return;
    }

    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }

    const nextSections = currentSections.map((section) => ({ ...section }));
    const targetId = this.getTargetId(event, targetSection.places);
    this.draggedPlaceId.set(null);
    this.daySections.set(nextSections);
    this.savePlaceOrder(nextSections, previousPlaces, {
      dayNumber: targetDayNumber,
      sourceId: draggedPlace.id,
      targetId,
    });
  }

  protected endPlaceDrag() {
    this.draggedPlaceId.set(null);
  }

  protected addPlaceLocally(place: TripPlace) {
    const updatedPlaces = [...this.getCurrentPlaces(), place];
    this.daySections.set(this.buildSections(updatedPlaces));
    this.placesChanged.emit(updatedPlaces);
  }

  protected trackTripPlace(_: number, place: TripPlace) {
    return place.id;
  }

  protected trackDaySection(_: number, section: PlaceDaySection) {
    return section.dayNumber ?? 'unscheduled';
  }

  protected getDaySectionId(dayNumber: number | null) {
    return dayNumber === null ? 'day-unscheduled' : `day-${dayNumber}`;
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

  private getTargetId(event: CdkDragDrop<TripPlace[]>, places: TripPlace[]) {
    if (places.length <= 1) {
      return null;
    }

    if (event.previousContainer === event.container) {
      if (event.previousIndex < event.currentIndex) {
        return places[event.currentIndex - 1]?.id ?? null;
      }

      if (event.previousIndex > event.currentIndex) {
        return places[event.currentIndex + 1]?.id ?? null;
      }

      return null;
    }

    return places[event.currentIndex + 1]?.id ?? places[event.currentIndex - 1]?.id ?? null;
  }

  private savePlaceOrder(
    sections: PlaceDaySection[],
    previousPlaces: TripPlace[],
    movedPlace: { dayNumber: number | null; sourceId: string; targetId: string | null },
  ) {
    this.message.set('');
    this.isReorderingPlaces.set(true);

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
          const updatedPlaces = this.mergeReorderedPlaces(places);
          this.daySections.set(this.buildSections(updatedPlaces));
          this.placesChanged.emit(updatedPlaces);
          this.message.set('Places reordered.');
        },
        error: () => {
          this.daySections.set(this.buildSections(previousPlaces));
          this.placesChanged.emit(previousPlaces);
          this.message.set('Could not reorder places. Please try again.');
        },
      });
  }

  private mergeReorderedPlaces(places: TripPlaceResponse[]) {
    const derivedOrderByDay = new Map<number | null, number>();

    return places.map((place) => {
      const nextDerivedOrder = (derivedOrderByDay.get(place.dayNumber) ?? 0) + 1;
      derivedOrderByDay.set(place.dayNumber, nextDerivedOrder);

      return {
        id: place.id,
        name: place.name,
        order: nextDerivedOrder,
        dayNumber: place.dayNumber,
        note: place.note,
        durationMinutes: place.durationMinutes,
        plannedTime: place.plannedTime,
      };
    });
  }

  protected getExistingPlaceNames() {
    return this.getCurrentPlaces().map((place) => place.name);
  }

  protected getNextUnscheduledOrder() {
    const unscheduledPlaces = this.getCurrentPlaces().filter((place) => place.dayNumber === null);
    return Math.max(0, ...unscheduledPlaces.map((place) => place.order)) + 1;
  }

  private getCurrentPlaces() {
    return this.flattenSections(this.daySections());
  }

  private buildSections(places: TripPlace[]) {
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

  private flattenSections(sections: PlaceDaySection[]) {
    return sections.flatMap((section) => section.places);
  }

  private arePlacesEquivalent(first: TripPlace[], second: TripPlace[]) {
    if (first.length !== second.length) {
      return false;
    }

    return first.every((place, index) => {
      const other = second[index];

      return (
        other &&
        place.id === other.id &&
        place.order === other.order &&
        place.dayNumber === other.dayNumber &&
        (place.note ?? null) === (other.note ?? null) &&
        (place.plannedTime ?? null) === (other.plannedTime ?? null) &&
        (place.durationMinutes ?? null) === (other.durationMinutes ?? null)
      );
    });
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
