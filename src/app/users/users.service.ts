import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { UserSearchResult } from './user.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  searchUsers(keyword: string) {
    return this.http.get<UserSearchResult[]>(`/api/Users/search/${encodeURIComponent(keyword)}`);
  }
}

