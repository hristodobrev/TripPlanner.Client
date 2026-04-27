import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';

import { PlaceDetailsResponse } from '../../places/place-search.models';
import { PlacesService } from '../../places/places.service';
import { GoogleMapsLoaderService } from '../../maps/google-maps-loader.service';
import { TripPlace } from '../trip.models';

@Component({
  selector: 'app-trip-map',
  imports: [CommonModule, MatIconModule],
  templateUrl: './trip-map.html',
  styleUrl: './trip-map.scss',
})
export class TripMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly mapsLoader = inject(GoogleMapsLoaderService);
  private readonly placesService = inject(PlacesService);

  @Input({ required: true }) tripId = '';
  @Input() places: TripPlace[] = [];
  @Output() readonly placeAdded = new EventEmitter<TripPlace>();

  @ViewChild('mapHost') private readonly mapHost?: ElementRef<HTMLDivElement>;

  protected readonly addingPlaceId = signal<string | null>(null);
  protected readonly isLoadingMap = signal(true);
  protected readonly mapError = signal('');
  protected readonly selectedPlace = signal<PlaceDetailsResponse | null>(null);
  protected readonly selectedPlaceCanAdd = signal(false);
  protected readonly selectedPlaceError = signal('');
  protected readonly selectedPlaceLoading = signal(false);
  protected readonly selectedPhotoIndex = signal(0);

  private isViewReady = false;
  private map: any | null = null;
  private markers: any[] = [];
  private selectedPlaceMarker: any | null = null;
  private renderSequence = 0;

  ngAfterViewInit() {
    this.isViewReady = true;
    void this.renderMap();
  }

  ngOnChanges(_: SimpleChanges) {
    if (!this.isViewReady) {
      return;
    }

    void this.renderMap();
  }

  ngOnDestroy() {
    this.clearMarkers();
    this.clearSelectedPlaceMarker();
  }

  protected closePlacePanel() {
    this.selectedPlace.set(null);
    this.selectedPlaceCanAdd.set(false);
    this.selectedPlaceError.set('');
    this.selectedPlaceLoading.set(false);
    this.selectedPhotoIndex.set(0);
    this.clearSelectedPlaceMarker();
  }

  protected addSelectedPlaceToTrip() {
    const place = this.selectedPlace();

    if (!place || !this.tripId || this.addingPlaceId()) {
      return;
    }

    this.addingPlaceId.set(place.externalPlaceId);

    this.placesService
      .addPlace({
        tripId: this.tripId,
        externalId: place.externalPlaceId,
        name: place.name,
      })
      .pipe(finalize(() => this.addingPlaceId.set(null)))
      .subscribe({
        next: (createdPlaceId) => {
          const nextOrder =
            Math.max(
              0,
              ...this.places
                .filter((tripPlace) => tripPlace.dayNumber === null)
                .map((tripPlace) => tripPlace.order),
            ) + 1;

          this.placeAdded.emit({
            id: createdPlaceId,
            externalPlaceId: place.externalPlaceId,
            formattedAddress: place.formattedAddress,
            name: place.name,
            order: nextOrder,
            dayNumber: null,
            locality: place.locality,
            country: place.country,
            latitude: place.latitude,
            longitude: place.longitude,
            rating: place.rating,
            websiteUri: place.websiteUri,
            userRatingCount: place.userRatingCount,
            primaryTypeDisplayName: place.primaryTypeDisplayName,
            note: null,
            durationMinutes: null,
            plannedTime: null,
          });

          this.selectedPlaceCanAdd.set(false);
        },
        error: () => this.selectedPlaceError.set('Could not add this place to the trip.'),
      });
  }

  protected hasSelectedPlaceAlreadyAdded() {
    const place = this.selectedPlace();

    return !!place && this.places.some((tripPlace) => tripPlace.externalPlaceId === place.externalPlaceId);
  }

  protected formatSelectedPlaceTime() {
    const place = this.selectedPlace();
    return place?.plannedTime ? this.toTimeDisplay(place.plannedTime) : '';
  }

  protected getSelectedPhotoUrl() {
    const place = this.selectedPlace();
    const photoUrls = place?.photoUrls ?? [];

    if (photoUrls.length === 0) {
      return null;
    }

    const index = Math.min(this.selectedPhotoIndex(), photoUrls.length - 1);
    return photoUrls[index] ?? null;
  }

  protected hasMultipleSelectedPhotos() {
    return (this.selectedPlace()?.photoUrls?.length ?? 0) > 1;
  }

  protected getSelectedPhotoCount() {
    return this.selectedPlace()?.photoUrls?.length ?? 0;
  }

  protected showPreviousPhoto() {
    const photoCount = this.selectedPlace()?.photoUrls?.length ?? 0;

    if (photoCount <= 1) {
      return;
    }

    this.selectedPhotoIndex.update((index) => (index - 1 + photoCount) % photoCount);
  }

  protected showNextPhoto() {
    const photoCount = this.selectedPlace()?.photoUrls?.length ?? 0;

    if (photoCount <= 1) {
      return;
    }

    this.selectedPhotoIndex.update((index) => (index + 1) % photoCount);
  }

  private async renderMap() {
    const mapHost = this.mapHost?.nativeElement;

    if (!mapHost) {
      return;
    }

    const currentRender = ++this.renderSequence;

    this.isLoadingMap.set(true);
    this.mapError.set('');

    try {
      await this.mapsLoader.load();

      if (currentRender !== this.renderSequence) {
        return;
      }

      const googleRef = (window as any).google;
      const { Map } = (await googleRef.maps.importLibrary('maps')) as any;
      const { AdvancedMarkerElement, PinElement } = (await googleRef.maps.importLibrary(
        'marker',
      )) as any;

      if (!this.map) {
        this.map = new Map(mapHost, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          mapId: 'DEMO_MAP_ID',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: 'greedy',
        });
      }

      const mappedPlaces = this.getMappablePlaces();

      if (currentRender !== this.renderSequence) {
        return;
      }

      this.clearMarkers();

      if (mappedPlaces.length === 0) {
        this.map.setCenter({ lat: 20, lng: 0 });
        this.map.setZoom(2);
        this.mapError.set(this.places.length > 0 ? 'No coordinates available for saved places.' : '');
        return;
      }

      this.map.addListener('click', (event: any) => {
        if (!event?.placeId) {
          return;
        }

        event.stop();
        this.loadPlaceDetails(
          event.placeId,
          !this.places.some((tripPlace) => tripPlace.externalPlaceId === event.placeId),
          '+',
        );
      });

      const bounds = new googleRef.maps.LatLngBounds();

      mappedPlaces.forEach((place, index) => {
        const location = {
          lat: place.latitude as number,
          lng: place.longitude as number,
        };
        const pin = new PinElement({
          glyph: String(index + 1),
          glyphColor: '#ffffff',
          background: '#1e7257',
          borderColor: '#14533f',
        });

        const marker = new AdvancedMarkerElement({
          map: this.map,
          position: location,
          title: place.name,
          content: pin.element,
        });

        marker.addListener('click', () =>
          this.loadPlaceDetails(place.externalPlaceId ?? place.id, false, String(index + 1)),
        );

        this.markers.push(marker);
        bounds.extend(location);
      });

      this.map.fitBounds(bounds, 56);
    } catch {
      this.mapError.set(
        'Could not load Google Maps. Check the API key and enabled APIs in Google Cloud.',
      );
    } finally {
      if (currentRender === this.renderSequence) {
        this.isLoadingMap.set(false);
      }
    }
  }

  private loadPlaceDetails(placeId: string, canAdd: boolean, glyph: string) {
    this.selectedPlace.set(null);
    this.selectedPlaceCanAdd.set(canAdd);
    this.selectedPlaceError.set('');
    this.selectedPlaceLoading.set(true);
    this.selectedPhotoIndex.set(0);

    this.placesService
      .getPlace(placeId)
      .pipe(finalize(() => this.selectedPlaceLoading.set(false)))
      .subscribe({
        next: (place) => {
          this.selectedPlace.set(place);
          this.selectedPlaceCanAdd.set(
            canAdd && !this.places.some((tripPlace) => tripPlace.externalPlaceId === place.externalPlaceId),
          );
          this.selectedPhotoIndex.set(0);
          void this.updateSelectedPlaceMarker(place, glyph);
        },
        error: () => this.selectedPlaceError.set('Could not load place details.'),
      });
  }

  private getMappablePlaces() {
    return this.places.filter(
      (place) =>
        typeof place.latitude === 'number' &&
        Number.isFinite(place.latitude) &&
        typeof place.longitude === 'number' &&
        Number.isFinite(place.longitude),
    );
  }

  private toTimeDisplay(value: string) {
    const timeParts = value.replace('Z', '').split(':');
    return timeParts.length >= 2 ? `${timeParts[0]}:${timeParts[1]}` : value;
  }

  private clearMarkers() {
    this.markers.forEach((marker) => {
      marker.map = null;
    });
    this.markers = [];
  }

  private async updateSelectedPlaceMarker(place: PlaceDetailsResponse, glyph = '+') {
    if (!this.map) {
      return;
    }

    const googleRef = (window as any).google;
    const { AdvancedMarkerElement, PinElement } = (await googleRef.maps.importLibrary(
      'marker',
    )) as any;

    this.clearSelectedPlaceMarker();

    const pin = new PinElement({
      glyph,
      glyphColor: '#ffffff',
      background: '#ce2b37',
      borderColor: '#991f28',
      scale: 1.25,
    });

    this.selectedPlaceMarker = new AdvancedMarkerElement({
      map: this.map,
      position: {
        lat: place.latitude,
        lng: place.longitude,
      },
      title: place.name,
      content: pin.element,
      zIndex: 1000,
    });
  }

  private clearSelectedPlaceMarker() {
    if (!this.selectedPlaceMarker) {
      return;
    }

    this.selectedPlaceMarker.map = null;
    this.selectedPlaceMarker = null;
  }
}
