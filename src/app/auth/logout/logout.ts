import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../auth.service';

@Component({
  selector: 'app-logout',
  template: '',
})
export class LogoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    this.authService.logout();
    void this.router.navigateByUrl('/');
  }
}
