import { Injectable } from '@angular/core';

interface GoogleMapsWindow extends Window {
  google?: {
    maps?: {
      importLibrary?: (name: string) => Promise<unknown>;
    };
  };
  __tripPlannerInitGoogleMaps__?: () => void;
}

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private readonly apiKey = 'AIzaSyDb8WKrOPQfcQOxOxkhtIcqoJPdC5K5mgI';
  private loadPromise?: Promise<void>;

  load() {
    const windowRef = window as GoogleMapsWindow;

    if (windowRef.google?.maps?.importLibrary) {
      return Promise.resolve();
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise<void>((resolve, reject) => {
      const callbackName = '__tripPlannerInitGoogleMaps__';
      const existingScript = document.getElementById('google-maps-script') as
        | HTMLScriptElement
        | null;

      const cleanup = () => {
        delete windowRef[callbackName];
      };

      windowRef[callbackName] = () => {
        cleanup();
        resolve();
      };

      if (existingScript) {
        existingScript.addEventListener('error', () => {
          cleanup();
          reject(new Error('Could not load Google Maps.'));
        });
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.async = true;
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}` +
        `&v=weekly&loading=async&callback=${callbackName}`;
      script.onerror = () => {
        cleanup();
        reject(new Error('Could not load Google Maps.'));
      };

      document.head.append(script);
    });

    return this.loadPromise;
  }
}
