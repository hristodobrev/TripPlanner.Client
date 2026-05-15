import { Routes } from '@angular/router';

import { authGuard } from './auth/auth.guard';
import { LoginComponent } from './auth/login/login';
import { LogoutComponent } from './auth/logout/logout';
import { RegisterComponent } from './auth/register/register';
import { HomeComponent } from './home/home';
import { TripDetailsComponent } from './trips/trip-details/trip-details';
import { TripPrintComponent } from './trips/trip-print/trip-print';
import { TripsListComponent } from './trips/trips-list/trips-list';

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [authGuard] },
  { path: 'trips', component: TripsListComponent, canActivate: [authGuard] },
  { path: 'trips/:id/print', component: TripPrintComponent, canActivate: [authGuard] },
  { path: 'trips/:id', component: TripDetailsComponent, canActivate: [authGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'logout', component: LogoutComponent },
  { path: 'register', component: RegisterComponent },
  { path: '**', redirectTo: '' },
];
