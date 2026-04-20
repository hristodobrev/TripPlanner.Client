import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { PlaceSearchComponent } from '../place-search/place-search';
import { PlacesService } from '../places.service';
import { Trip, TripPlace } from '../../trips/trip.models';

interface PlaceDaySection {
  dayNumber: number | null;
  title: string;
  places: TripPlace[];
}

@Component({
  selector: 'app-trip-places',
  imports: [PlaceSearchComponent],
  templateUrl: './trip-places.html',
  styleUrl: './trip-places.scss',
})
export class TripPlacesComponent {
  private readonly placesService = inject(PlacesService);

  @Input({ required: true }) trip!: Trip;

  @Output() readonly placesChanged = new EventEmitter<TripPlace[]>();

  protected readonly draggedPlaceId = signal<string | null>(null);
  protected readonly deletingPlaceId = signal<string | null>(null);
  protected readonly editingNotePlaceId = signal<string | null>(null);
  protected readonly isReorderingPlaces = signal(false);
  protected readonly message = signal('');
  protected readonly noteDraft = signal('');
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
    if (!confirm(`Remove ${place.name} from this trip?`)) {
      return;
    }

    this.message.set('');
    this.deletingPlaceId.set(place.id);

    this.placesService
      .deletePlace(place.id)
      .pipe(finalize(() => this.deletingPlaceId.set(null)))
      .subscribe({
        next: () => {
          this.placesChanged.emit((this.trip.places ?? []).filter((item) => item.id !== place.id));
          this.message.set('Place removed from this trip.');
        },
        error: () => this.message.set('Could not remove this place. Please try again.'),
      });
  }

  protected startNoteEdit(place: TripPlace) {
    this.message.set('');
    this.editingNotePlaceId.set(place.id);
    this.noteDraft.set(place.note ?? '');
  }

  protected cancelNoteEdit() {
    this.editingNotePlaceId.set(null);
    this.noteDraft.set('');
  }

  protected updateNoteDraft(value: string) {
    this.noteDraft.set(value);
  }

  protected saveNote(place: TripPlace) {
    const note = this.noteDraft().trim();

    this.message.set('');
    this.savingNotePlaceId.set(place.id);

    this.placesService
      .updatePlaceNote(place.id, {
        placeId: place.id,
        ...(note ? { note } : {}),
      })
      .pipe(finalize(() => this.savingNotePlaceId.set(null)))
      .subscribe({
        next: () => {
          this.placesChanged.emit(
            (this.trip.places ?? []).map((item) =>
              item.id === place.id ? { ...item, note: note || null } : item,
            ),
          );
          this.cancelNoteEdit();
          this.message.set(note ? 'Note saved.' : 'Note removed.');
        },
        error: () => this.message.set('Could not save the note. Please try again.'),
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

    targetSection.places.splice(targetIndex >= 0 ? targetIndex : targetSection.places.length, 0, {
      ...draggedPlace,
      dayNumber: targetDayNumber,
    });

    this.draggedPlaceId.set(null);
    this.savePlaceOrder(nextSections);
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

  private getPlacesForDay(places: TripPlace[], dayNumber: number | null) {
    return places
      .filter((place) => place.dayNumber === dayNumber)
      .sort((first, second) => first.order - second.order);
  }

  private savePlaceOrder(sections: PlaceDaySection[]) {
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
      .reorderPlaces({
        tripId: this.trip.id,
        days: sections.map((section) => ({
          dayNumber: section.dayNumber,
          placeIds: section.places.map((place) => place.id),
        })),
      })
      .pipe(finalize(() => this.isReorderingPlaces.set(false)))
      .subscribe({
        next: () => this.message.set('Places reordered.'),
        error: () => {
          this.placesChanged.emit(previousPlaces);
          this.message.set('Could not reorder places. Please try again.');
        },
      });
  }

  protected getExistingPlaceNames() {
    return (this.trip.places ?? []).map((place) => place.name);
  }

  protected getNextUnscheduledOrder() {
    const unscheduledPlaces = (this.trip.places ?? []).filter((place) => place.dayNumber === null);
    return Math.max(0, ...unscheduledPlaces.map((place) => place.order)) + 1;
  }
}
