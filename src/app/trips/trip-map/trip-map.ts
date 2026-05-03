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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';

import {
  AccommodationSearchResult,
  PlaceDetailsResponse,
} from '../../places/place-search.models';
import { PlaceSearchService } from '../../places/placesearch.service';
import { PlacesService } from '../../places/places.service';
import { GoogleMapsLoaderService } from '../../maps/google-maps-loader.service';
import { TripPlace } from '../trip.models';

@Component({
  selector: 'app-trip-map',
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './trip-map.html',
  styleUrl: './trip-map.scss',
})
export class TripMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly mapsLoader = inject(GoogleMapsLoaderService);
  private readonly placeSearchService = inject(PlaceSearchService);
  private readonly placesService = inject(PlacesService);

  @Input({ required: true }) tripId = '';
  @Input() destinationLatitude: number | null = null;
  @Input() destinationLongitude: number | null = null;
  @Input() places: TripPlace[] = [];
  @Output() readonly placeAdded = new EventEmitter<TripPlace>();

  @ViewChild('mapHost') private readonly mapHost?: ElementRef<HTMLDivElement>;

  protected readonly addingPlaceId = signal<string | null>(null);
  protected readonly isLoadingAccommodations = signal(false);
  protected readonly isLoadingMap = signal(true);
  protected readonly mapError = signal('');
  protected readonly panelContentScrollable = signal(false);
  protected readonly selectedPlace = signal<PlaceDetailsResponse | null>(null);
  protected readonly selectedPlaceCanAdd = signal(false);
  protected readonly selectedPhotoIndex = signal(0);

  private panelContentResizeObserver: ResizeObserver | null = null;
  private panelContentElement: HTMLDivElement | null = null;
  private isViewReady = false;
  private accommodationHoverInfoWindow: any | null = null;
  private accommodationMarkers: any[] = [];
  private map: any | null = null;
  private mapClickListener: any | null = null;
  private markers: any[] = [];
  private selectedPlaceMarker: any | null = null;
  private renderSequence = 0;

  ngAfterViewInit() {
    this.isViewReady = true;
    this.observePanelContent();
    void this.renderMap();
  }

  ngOnChanges(_: SimpleChanges) {
    if (!this.isViewReady) {
      return;
    }

    void this.renderMap();
  }

  ngOnDestroy() {
    this.panelContentResizeObserver?.disconnect();
    this.mapClickListener?.remove?.();
    this.clearMarkers();
    this.clearAccommodationMarkers();
    this.clearSelectedPlaceMarker();
  }

  @ViewChild('panelContent')
  private set panelContentRef(content: ElementRef<HTMLDivElement> | undefined) {
    this.panelContentElement = content?.nativeElement ?? null;
    this.observePanelContent();
  }

  protected searchAccommodations() {
    if (this.hasAccommodationMarkers()) {
      this.clearAccommodationMarkers();
      return;
    }

    if (!this.map || this.isLoadingAccommodations()) {
      return;
    }

    const center = this.map.getCenter?.();
    const latitude = center?.lat?.();
    const longitude = center?.lng?.();

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      this.mapError.set('Could not determine the current map center.');
      return;
    }

    this.mapError.set('');
    this.isLoadingAccommodations.set(true);

    this.placeSearchService
      .getAccommodations(latitude, longitude)
      .pipe(finalize(() => this.isLoadingAccommodations.set(false)))
      .subscribe({
        next: async (places) => {
          await this.renderAccommodationMarkers(places);
        },
        error: () => this.mapError.set('Could not load accommodations for this area.'),
      });
  }

  protected closePlacePanel() {
    this.selectedPlace.set(null);
    this.selectedPlaceCanAdd.set(false);
    this.selectedPhotoIndex.set(0);
    this.panelContentScrollable.set(false);
    this.clearSelectedPlaceMarker();
  }

  protected addSelectedPlaceToTrip() {
    const place = this.selectedPlace();

    if (!place || !this.tripId || this.addingPlaceId()) {
      return;
    }

    this.addingPlaceId.set(place.externalId);

    this.placesService
      .addPlace({
        tripId: this.tripId,
        externalId: place.externalId,
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
            externalPlaceId: place.externalId,
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
          this.refreshPanelScrollability();
        },
        error: () => this.mapError.set('Could not add this place to the trip.'),
      });
  }

  protected hasSelectedPlaceAlreadyAdded() {
    const place = this.selectedPlace();

    return !!place && this.places.some((tripPlace) => tripPlace.externalPlaceId === place.externalId);
  }

  protected getSelectedPlaceMarkerNumber() {
    const place = this.selectedPlace();

    if (!place) {
      return null;
    }

    const markerIndex = this.getMappablePlaces().findIndex(
      (tripPlace) => tripPlace.externalPlaceId === place.externalId,
    );

    return markerIndex >= 0 ? markerIndex + 1 : null;
  }

  protected formatSelectedPlaceTime() {
    const place = this.selectedPlace();
    return place?.plannedTime ? this.toTimeDisplay(place.plannedTime) : '';
  }

  protected formatSelectedPlaceReviewCount() {
    const reviewCount = this.selectedPlace()?.userRatingCount;

    if (!reviewCount) {
      return '';
    }

    return `${new Intl.NumberFormat('en', {
      notation: reviewCount >= 1000 ? 'compact' : 'standard',
      maximumFractionDigits: 1,
    }).format(reviewCount)} reviews`;
  }

  protected getSelectedPlaceWebsiteLabel() {
    const websiteUri = this.selectedPlace()?.websiteUri;

    if (!websiteUri) {
      return '';
    }

    try {
      return new URL(websiteUri).hostname.replace(/^www\./, '');
    } catch {
      return websiteUri;
    }
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

  protected hasAccommodationMarkers() {
    return this.accommodationMarkers.length > 0;
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
      this.accommodationHoverInfoWindow ??= new googleRef.maps.InfoWindow();

      if (!this.map) {
        this.map = new Map(mapHost, {
          center: this.getDefaultMapCenter(),
          zoom: this.hasDestinationViewport() ? 12 : 2,
          mapId: 'DEMO_MAP_ID',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
        });
      }

      this.mapClickListener?.remove?.();
      this.mapClickListener = this.map.addListener('click', (event: any) => {
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

      const mappedPlaces = this.getMappablePlaces();

      if (currentRender !== this.renderSequence) {
        return;
      }

      this.clearMarkers();

      if (mappedPlaces.length === 0) {
        this.map.setCenter(this.getDefaultMapCenter());
        this.map.setZoom(this.hasDestinationViewport() ? 12 : 2);
        this.mapError.set(this.places.length > 0 ? 'No coordinates available for saved places.' : '');
        return;
      }

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
    this.selectedPlaceCanAdd.set(canAdd);
    this.selectedPhotoIndex.set(0);
    this.mapError.set('');

    this.placeSearchService
      .getPlace(placeId)
      .subscribe({
        next: (place) => {
          this.selectedPlace.set(place);
          this.selectedPlaceCanAdd.set(
            canAdd && !this.places.some((tripPlace) => tripPlace.externalPlaceId === place.externalId),
          );
          this.selectedPhotoIndex.set(0);
          this.refreshPanelScrollability();
          void this.updateSelectedPlaceMarker(place, glyph);
        },
        error: () => this.mapError.set('Could not load place details.'),
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

  private hasDestinationViewport() {
    return (
      typeof this.destinationLatitude === 'number' &&
      Number.isFinite(this.destinationLatitude) &&
      typeof this.destinationLongitude === 'number' &&
      Number.isFinite(this.destinationLongitude)
    );
  }

  private getDefaultMapCenter() {
    if (this.hasDestinationViewport()) {
      return {
        lat: this.destinationLatitude as number,
        lng: this.destinationLongitude as number,
      };
    }

    return { lat: 20, lng: 0 };
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

  private clearAccommodationMarkers() {
    this.accommodationMarkers.forEach((marker) => {
      marker.map = null;
    });
    this.accommodationMarkers = [];
    this.accommodationHoverInfoWindow?.close();
  }

  private async renderAccommodationMarkers(places: AccommodationSearchResult[]) {
    if (!this.map) {
      return;
    }

    const googleRef = (window as any).google;
    const { AdvancedMarkerElement, PinElement } = (await googleRef.maps.importLibrary(
      'marker',
    )) as any;

    this.clearAccommodationMarkers();

    places.forEach((place) => {
      const pin = new PinElement({
        glyph: 'H',
        glyphColor: '#ffffff',
        background: '#2a6fd6',
        borderColor: '#1f57ab',
      });

      const marker = new AdvancedMarkerElement({
        map: this.map,
        position: {
          lat: place.latitude,
          lng: place.longitude,
        },
        title: this.buildAccommodationTooltipText(place),
        content: pin.element,
      });

      marker.addListener('mouseover', () => {
        this.accommodationHoverInfoWindow?.setContent(this.buildAccommodationTooltipHtml(place));
        this.accommodationHoverInfoWindow?.open({
          anchor: marker,
          map: this.map,
        });
      });

      marker.addListener('mouseout', () => {
        this.accommodationHoverInfoWindow?.close();
      });

      marker.addListener('click', () => {
        this.accommodationHoverInfoWindow?.close();
        this.loadPlaceDetails(
          place.externalPlaceId,
          !this.places.some((tripPlace) => tripPlace.externalPlaceId === place.externalPlaceId),
          'H',
        );
      });

      this.accommodationMarkers.push(marker);
    });
  }

  private buildAccommodationTooltipText(place: AccommodationSearchResult) {
    return place.rating ? `${place.name} - ${place.rating}` : place.name;
  }

  private buildAccommodationTooltipHtml(place: AccommodationSearchResult) {
    const ratingText = place.rating
      ? `<div style="margin-top:4px;color:#52615d;font-size:12px;line-height:1.4;">Rating ${place.rating}</div>`
      : '';
    return `
      <div style="padding:2px 0;font-family:Roboto, Arial, sans-serif;">
        <strong>${this.escapeHtml(place.name)}</strong>
        ${ratingText}
      </div>
    `;
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

  private observePanelContent() {
    const panelContent = this.panelContentElement;

    if (!panelContent || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.panelContentResizeObserver?.disconnect();
    this.panelContentResizeObserver = new ResizeObserver(() => this.refreshPanelScrollability());
    this.panelContentResizeObserver.observe(panelContent);
    this.refreshPanelScrollability();
  }

  private refreshPanelScrollability() {
    requestAnimationFrame(() => {
      const panelContent = this.panelContentElement;

      if (!panelContent) {
        this.panelContentScrollable.set(false);
        return;
      }

      this.panelContentScrollable.set(panelContent.scrollHeight > panelContent.clientHeight + 1);
    });
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
