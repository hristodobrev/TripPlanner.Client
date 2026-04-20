import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getAccessToken();

  const isApiRequest = request.url.startsWith('/api');
  const isAuthRequest = request.url.startsWith('/api/auth');
  const authorizedRequest =
    token && isApiRequest && !isAuthRequest
      ? request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        })
      : request;

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (isApiRequest && !isAuthRequest && error instanceof HttpErrorResponse && error.status === 401) {
        authService.logout();

        if (router.url !== '/login') {
          void router.navigateByUrl('/login');
        }
      }

      return throwError(() => error);
    }),
  );
};
