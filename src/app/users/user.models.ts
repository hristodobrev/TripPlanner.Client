export interface UserSearchResult {
  id: string;
  fullName: string;
  email: string;
}

export interface UserDashboard {
  tripsCount: number;
  visitedPlacesCount: number;
  plannedPlacesCount: number;
}
