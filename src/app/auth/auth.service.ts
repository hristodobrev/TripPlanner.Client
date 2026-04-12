import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';

import { AuthResponse, LoginRequest, RegisterRequest } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/auth';
  private readonly storageKey = 'tripplanner.auth';
  private readonly session = signal<AuthResponse | null>(this.readSession());

  readonly currentUser = this.session.asReadonly();

  login(request: LoginRequest) {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, request)
      .pipe(tap((response) => this.setSession(response)));
  }

  register(request: RegisterRequest) {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/register`, request)
      .pipe(tap((response) => this.setSession(response)));
  }

  logout() {
    this.session.set(null);

    if (this.hasBrowserStorage()) {
      localStorage.removeItem(this.storageKey);
    }
  }

  getAccessToken() {
    return this.session()?.accessToken ?? null;
  }

  private setSession(response: AuthResponse) {
    this.session.set(response);

    if (this.hasBrowserStorage()) {
      localStorage.setItem(this.storageKey, JSON.stringify(response));
    }
  }

  private readSession() {
    if (!this.hasBrowserStorage()) {
      return null;
    }

    try {
      const rawSession = localStorage.getItem(this.storageKey);

      if (!rawSession) {
        return null;
      }

      const session = JSON.parse(rawSession) as AuthResponse;

      if (!session.accessToken || this.isExpired(session.expiresAtUtc)) {
        localStorage.removeItem(this.storageKey);
        return null;
      }

      return session;
    } catch {
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }

  private isExpired(expiresAtUtc: string) {
    const expiresAt = Date.parse(expiresAtUtc);
    return Number.isNaN(expiresAt) || expiresAt <= Date.now();
  }

  private hasBrowserStorage() {
    return typeof localStorage !== 'undefined';
  }
}
