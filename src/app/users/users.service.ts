import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { UserDashboard, UserSearchResult } from './user.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  searchUsers(keyword: string) {
    return this.http.get<UserSearchResult[]>(`/api/Users/search/${encodeURIComponent(keyword)}`);
  }

  getDashboard() {
    return this.http.get<UserDashboard>('/api/Users/dashboard');
  }
}
