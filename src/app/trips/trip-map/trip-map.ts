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
  PlaceSearchResult,
  RecommendationSearchResult,
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
  @Input() tripName = '';
  @Input() destinationLatitude: number | null = null;
  @Input() destinationLongitude: number | null = null;
  @Input() isEditable = true;
  @Input() places: TripPlace[] = [];
  @Output() readonly placeAdded = new EventEmitter<TripPlace>();

  @ViewChild('mapHost') private readonly mapHost?: ElementRef<HTMLDivElement>;
  @ViewChild('searchInput') private readonly searchInput?: ElementRef<HTMLInputElement>;

  protected readonly addingPlaceId = signal<string | null>(null);
  protected readonly hasAccommodationMarkers = signal(false);
  protected readonly hasRecommendationMarkers = signal(false);
  protected readonly hasSearchMarkers = signal(false);
  protected readonly isLoadingAccommodations = signal(false);
  protected readonly isLoadingRecommendations = signal(false);
  protected readonly isLoadingSearch = signal(false);
  protected readonly isLoadingMap = signal(true);
  protected readonly isSearchOpen = signal(false);
  protected readonly mapError = signal('');
  protected readonly panelContentScrollable = signal(false);
  protected readonly resultSource = signal<'search' | 'recommendations' | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly searchResults = signal<PlaceSearchResult[]>([]);
  protected readonly selectedPlace = signal<PlaceDetailsResponse | null>(null);
  protected readonly selectedPlaceCanAdd = signal(false);
  protected readonly selectedSearchPlaceId = signal<string | null>(null);
  protected readonly selectedPhotoIndex = signal(0);

  private panelContentResizeObserver: ResizeObserver | null = null;
  private panelContentElement: HTMLDivElement | null = null;
  private isViewReady = false;
  private accommodationHoverInfoWindow: any | null = null;
  private accommodationMarkers: any[] = [];
  private map: any | null = null;
  private mapClickListener: any | null = null;
  private markers: any[] = [];
  private recommendationMarkers: any[] = [];
  private searchMarkers: any[] = [];
  private selectedPlaceMarker: any | null = null;
  private renderSequence = 0;
  private searchRequestSequence = 0;

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
    this.clearRecommendationMarkers();
    this.clearSearchMarkers();
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

  protected searchRecommendations() {
    if (this.hasRecommendationMarkers()) {
      this.closeRecommendations();
      return;
    }

    if (!this.map || this.isLoadingRecommendations() || !this.tripName.trim()) {
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
    this.isLoadingRecommendations.set(true);

    this.placeSearchService
      .getRecommendations(latitude, longitude, this.tripName.trim())
      .pipe(finalize(() => this.isLoadingRecommendations.set(false)))
      .subscribe({
        next: async (places) => {
          await this.renderRecommendationMarkers(places);
          this.resultSource.set('recommendations');
          this.searchResults.set(places as PlaceSearchResult[]);
          this.showSearchResultsList();
        },
        error: () => this.mapError.set('Could not load attractions for this area.'),
      });
  }

  protected toggleSearch() {
    if (this.isSearchOpen()) {
      this.closeSearch();
      return;
    }

    this.isSearchOpen.set(true);
    this.mapError.set('');
    requestAnimationFrame(() => this.searchInput?.nativeElement.focus());
  }

  protected updateSearchQuery(value: string) {
    this.searchQuery.set(value);

    if (!value.trim()) {
      this.searchRequestSequence += 1;
      this.isLoadingSearch.set(false);
      this.clearSearchMarkers();
    }
  }

  protected handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSearch();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const query = this.searchQuery().trim();

      if (!query) {
        this.clearSearchMarkers();
        return;
      }

      void this.searchPlacesOnMap(query);
    }
  }

  protected selectSearchResult(place: PlaceSearchResult) {
    this.selectedSearchPlaceId.set(place.externalPlaceId);
    this.loadPlaceDetails(
      place.externalPlaceId,
      !this.places.some((tripPlace) => tripPlace.externalPlaceId === place.externalPlaceId),
      String(this.getSearchResultNumber(place.externalPlaceId)),
    );
  }

  protected getSearchResultNumber(externalPlaceId: string) {
    const markerIndex = this.searchResults().findIndex((place) => place.externalPlaceId === externalPlaceId);
    return markerIndex >= 0 ? markerIndex + 1 : 0;
  }

  protected isSelectedSearchResult(externalPlaceId: string) {
    return this.selectedSearchPlaceId() === externalPlaceId;
  }

  protected hasSearchResults() {
    return this.searchResults().length > 0;
  }

  protected getResultsHeading() {
    return this.resultSource() === 'recommendations' ? 'Attractions' : 'Search results';
  }

  protected isShowingSearchResultDetails() {
    return this.hasSearchResults() && !!this.selectedSearchPlaceId() && !!this.selectedPlace();
  }

  protected getSearchResultMeta(place: PlaceSearchResult) {
    const location = [place.locality, place.country].filter(Boolean).join(', ');

    if (place.primaryTypeDisplayName && location) {
      return `${place.primaryTypeDisplayName} · ${location}`;
    }

    return place.primaryTypeDisplayName || location;
  }

  protected showSearchResultsList() {
    this.selectedPlace.set(null);
    this.selectedPlaceCanAdd.set(false);
    this.selectedSearchPlaceId.set(null);
    this.selectedPhotoIndex.set(0);
    this.panelContentScrollable.set(false);
    this.clearSelectedPlaceMarker();
  }

  protected closePlacePanel() {
    if (this.resultSource() === 'search') {
      this.closeSearch();
      return;
    }

    if (this.resultSource() === 'recommendations') {
      this.closeRecommendations();
      return;
    }

    this.selectedPlace.set(null);
    this.selectedPlaceCanAdd.set(false);
    this.selectedSearchPlaceId.set(null);
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

    return `${this.formatReviewCount(reviewCount)} reviews`;
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

  protected formatReviewCount(reviewCount: number | null | undefined) {
    if (!reviewCount) {
      return '';
    }

    return new Intl.NumberFormat('en', {
      notation: reviewCount >= 1000 ? 'compact' : 'standard',
      maximumFractionDigits: 1,
    }).format(reviewCount);
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
    if (!this.searchResults().some((result) => result.externalPlaceId === placeId)) {
      this.selectedSearchPlaceId.set(null);
    }

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
    this.hasAccommodationMarkers.set(false);
  }

  private clearRecommendationMarkers() {
    this.recommendationMarkers.forEach((marker) => {
      marker.map = null;
    });
    this.recommendationMarkers = [];
    this.accommodationHoverInfoWindow?.close();
    this.hasRecommendationMarkers.set(false);

    if (this.resultSource() === 'recommendations') {
      this.searchResults.set([]);
      this.selectedSearchPlaceId.set(null);
      this.resultSource.set(null);
    }
  }

  private clearSearchMarkers() {
    this.searchMarkers.forEach((marker) => {
      marker.map = null;
    });
    this.searchMarkers = [];
    this.accommodationHoverInfoWindow?.close();
    this.hasSearchMarkers.set(false);
    this.selectedSearchPlaceId.set(null);

    if (this.resultSource() === 'search') {
      this.searchResults.set([]);
      this.resultSource.set(null);
    }
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

    this.hasAccommodationMarkers.set(this.accommodationMarkers.length > 0);
  }

  private async renderRecommendationMarkers(places: RecommendationSearchResult[]) {
    if (!this.map) {
      return;
    }

    const googleRef = (window as any).google;
    const { AdvancedMarkerElement, PinElement } = (await googleRef.maps.importLibrary(
      'marker',
    )) as any;

    this.clearRecommendationMarkers();

    places.forEach((place, index) => {
      const pin = new PinElement({
        glyph: String(index + 1),
        glyphColor: '#ffffff',
        background: '#ce8b1f',
        borderColor: '#9e670f',
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
        this.selectSearchResult(place as PlaceSearchResult);
      });

      this.recommendationMarkers.push(marker);
    });

    this.hasRecommendationMarkers.set(this.recommendationMarkers.length > 0);
  }

  private async searchPlacesOnMap(query: string) {
    if (!this.map) {
      return;
    }

    const center = this.map.getCenter?.();
    const latitude = center?.lat?.();
    const longitude = center?.lng?.();

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      this.mapError.set('Could not determine the current map center.');
      return;
    }

    const currentSearch = ++this.searchRequestSequence;
    this.mapError.set('');
    this.isLoadingSearch.set(true);

    this.placeSearchService
      .searchPlaces(latitude, longitude, query)
      .pipe(finalize(() => {
        if (currentSearch === this.searchRequestSequence) {
          this.isLoadingSearch.set(false);
        }
      }))
      .subscribe({
        next: async (places) => {
          if (currentSearch !== this.searchRequestSequence) {
            return;
          }

          await this.renderSearchMarkers(places);
          this.resultSource.set('search');
          this.searchResults.set(places);
          this.showSearchResultsList();
        },
        error: () => {
          if (currentSearch !== this.searchRequestSequence) {
            return;
          }

          this.mapError.set('Could not search places in this area.');
        },
      });
  }

  private async renderSearchMarkers(places: PlaceSearchResult[]) {
    if (!this.map) {
      return;
    }

    const googleRef = (window as any).google;
    const { AdvancedMarkerElement, PinElement } = (await googleRef.maps.importLibrary(
      'marker',
    )) as any;

    this.clearSearchMarkers();

    places.forEach((place, index) => {
      const pin = new PinElement({
        glyph: String(index + 1),
        glyphColor: '#ffffff',
        background: '#7d4cc2',
        borderColor: '#6032a0',
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
        this.selectSearchResult(place);
      });

      this.searchMarkers.push(marker);
    });

    this.hasSearchMarkers.set(this.searchMarkers.length > 0);
  }

  private closeSearch() {
    this.isSearchOpen.set(false);
    this.searchQuery.set('');
    this.searchRequestSequence += 1;
    this.isLoadingSearch.set(false);
    this.selectedPlace.set(null);
    this.selectedPlaceCanAdd.set(false);
    this.selectedPhotoIndex.set(0);
    this.panelContentScrollable.set(false);
    this.clearSearchMarkers();
    this.clearSelectedPlaceMarker();
  }

  private closeRecommendations() {
    this.selectedPlace.set(null);
    this.selectedPlaceCanAdd.set(false);
    this.selectedPhotoIndex.set(0);
    this.panelContentScrollable.set(false);
    this.clearRecommendationMarkers();
    this.clearSelectedPlaceMarker();
  }

  private buildAccommodationTooltipText(
    place: AccommodationSearchResult | RecommendationSearchResult | PlaceSearchResult,
  ) {
    return place.rating ? `${place.name} - ${place.rating}` : place.name;
  }

  private buildAccommodationTooltipHtml(
    place: AccommodationSearchResult | RecommendationSearchResult | PlaceSearchResult,
  ) {
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
