import { Component, inject, OnDestroy, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { UserSearchResult } from '../../users/user.models';
import { UsersService } from '../../users/users.service';
import { TripPermission, TripShare } from '../trip.models';
import { TripsService } from '../trips.service';

export interface ShareTripDialogData {
  tripId: string;
  tripName: string;
}

@Component({
  selector: 'app-share-trip-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './share-trip-dialog.html',
  styleUrl: './share-trip-dialog.scss',
})
export class ShareTripDialogComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly data = inject<ShareTripDialogData>(MAT_DIALOG_DATA);
  private readonly tripsService = inject(TripsService);
  private readonly usersService = inject(UsersService);
  private userSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private userSearchSequence = 0;

  protected readonly isLoadingShares = signal(true);
  protected readonly deletingShareId = signal<string | null>(null);
  protected readonly sharingTrip = signal(false);
  protected readonly updatingShareId = signal<string | null>(null);
  protected readonly shareKeyword = signal('');
  protected readonly isSearchingUsers = signal(false);
  protected readonly tripShares = signal<TripShare[]>([]);
  protected readonly userSearchResults = signal<UserSearchResult[]>([]);
  protected readonly selectedUser = signal<UserSearchResult | null>(null);
  protected readonly selectedPermission = signal(TripPermission.ReadOnly);
  protected readonly shareMessage = signal('');
  protected readonly tripPermission = TripPermission;

  protected readonly tripName = this.data.tripName;

  constructor() {
    this.loadTripShares();
  }

  ngOnDestroy() {
    this.clearUserSearchTimer();
  }

  protected updateShareKeyword(value: string) {
    this.shareKeyword.set(value);
    this.selectedUser.set(null);
    this.shareMessage.set('');
    this.clearUserSearchTimer();

    const keyword = value.trim();

    if (keyword.length < 2) {
      this.userSearchSequence += 1;
      this.isSearchingUsers.set(false);
      this.userSearchResults.set([]);
      return;
    }

    this.userSearchTimer = setTimeout(() => {
      this.searchUsers(keyword);
    }, 250);
  }

  protected selectUser(user: UserSearchResult) {
    this.selectedUser.set(user);
    this.shareKeyword.set(`${user.fullName} (${user.email})`);
    this.userSearchResults.set([]);
    this.shareMessage.set('');
  }

  protected updateSelectedPermission(value: TripPermission) {
    this.selectedPermission.set(value);
  }

  protected shareTripWithUser() {
    const selectedUser = this.selectedUser();

    if (!selectedUser || this.sharingTrip()) {
      return;
    }

    if (!this.canShareWithUser(selectedUser)) {
      this.shareMessage.set('You cannot share this trip with that user.');
      this.resetShareForm();
      return;
    }

    this.shareMessage.set('');
    this.sharingTrip.set(true);

    this.tripsService
      .shareTrip(this.data.tripId, {
        userId: selectedUser.id,
        permission: this.selectedPermission(),
      })
      .pipe(finalize(() => this.sharingTrip.set(false)))
      .subscribe({
        next: () => {
          this.shareMessage.set(`Shared with ${selectedUser.fullName}.`);
          this.loadTripShares();
          this.resetShareForm();
        },
        error: () => {
          this.shareMessage.set('Could not share this trip. Please try again.');
        },
      });
  }

  protected clearSelectedUser() {
    this.selectedUser.set(null);
    this.shareKeyword.set('');
    this.shareMessage.set('');
  }

  protected getPermissionLabel(permission: TripPermission) {
    return permission === TripPermission.Edit ? 'Edit' : 'Read only';
  }

  protected hasEligibleUserResults() {
    return this.userSearchResults().length > 0;
  }

  protected toggleSharePermission(share: TripShare) {
    this.updateSharePermission(
      share,
      share.permission === TripPermission.Edit ? TripPermission.ReadOnly : TripPermission.Edit,
    );
  }

  protected updateSharePermission(share: TripShare, permission: TripPermission) {
    if (this.updatingShareId() === share.id || share.permission === permission) {
      return;
    }

    const previousShares = this.tripShares();
    const updatedShares = previousShares.map((item) =>
      item.id === share.id
        ? {
            ...item,
            permission,
          }
        : item,
    );

    this.shareMessage.set('');
    this.updatingShareId.set(share.id);
    this.tripShares.set(updatedShares);

    this.tripsService
      .updateTripShare(this.data.tripId, share.id, { permission })
      .pipe(finalize(() => this.updatingShareId.set(null)))
      .subscribe({
        next: () => undefined,
        error: () => {
          this.tripShares.set(previousShares);
          this.shareMessage.set('Could not update this share. Please try again.');
        },
      });
  }

  protected deleteShare(share: TripShare) {
    if (this.deletingShareId() === share.id) {
      return;
    }

    this.shareMessage.set('');
    this.deletingShareId.set(share.id);

    this.tripsService
      .deleteTripShare(this.data.tripId, share.id)
      .pipe(finalize(() => this.deletingShareId.set(null)))
      .subscribe({
        next: () => {
          this.tripShares.update((shares) => shares.filter((item) => item.id !== share.id));
          this.shareMessage.set(`Removed ${share.userFullName} from this trip.`);
        },
        error: () => {
          this.shareMessage.set('Could not remove this share. Please try again.');
        },
      });
  }

  private loadTripShares() {
    this.isLoadingShares.set(true);

    this.tripsService
      .getTripShares(this.data.tripId)
      .pipe(finalize(() => this.isLoadingShares.set(false)))
      .subscribe({
        next: (shares) => this.tripShares.set(shares),
        error: () => {
          this.tripShares.set([]);
          this.shareMessage.set('Could not load existing shares.');
        },
      });
  }

  private searchUsers(keyword: string) {
    const currentSearch = ++this.userSearchSequence;
    this.isSearchingUsers.set(true);

    this.usersService
      .searchUsers(keyword)
      .pipe(finalize(() => {
        if (currentSearch === this.userSearchSequence) {
          this.isSearchingUsers.set(false);
        }
      }))
      .subscribe({
        next: (users) => {
          if (currentSearch !== this.userSearchSequence) {
            return;
          }

          this.userSearchResults.set(users.filter((user) => this.canShareWithUser(user)));
        },
        error: () => {
          if (currentSearch !== this.userSearchSequence) {
            return;
          }

          this.userSearchResults.set([]);
          this.shareMessage.set('Could not search users right now.');
        },
      });
  }

  private resetShareForm() {
    this.shareKeyword.set('');
    this.selectedUser.set(null);
    this.userSearchResults.set([]);
    this.selectedPermission.set(TripPermission.ReadOnly);
  }

  private canShareWithUser(user: UserSearchResult) {
    return !this.isCurrentUser(user) && !this.isAlreadyShared(user);
  }

  private isAlreadyShared(user: UserSearchResult) {
    return this.tripShares().some((share) => share.userId === user.id);
  }

  private isCurrentUser(user: UserSearchResult) {
    const currentUserEmail = this.authService.currentUser()?.email?.trim().toLowerCase();
    return !!currentUserEmail && user.email.trim().toLowerCase() === currentUserEmail;
  }

  private clearUserSearchTimer() {
    if (!this.userSearchTimer) {
      return;
    }

    clearTimeout(this.userSearchTimer);
    this.userSearchTimer = null;
  }
}
