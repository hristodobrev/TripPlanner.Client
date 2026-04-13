import { Routes } from '@angular/router';

import { LoginComponent } from './auth/login/login';
import { RegisterComponent } from './auth/register/register';
import { HomeComponent } from './home/home';
import { TripDetailsComponent } from './trips/trip-details/trip-details';
import { TripsListComponent } from './trips/trips-list/trips-list';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'trips', component: TripsListComponent },
  { path: 'trips/:id', component: TripDetailsComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: '**', redirectTo: '' },
];
