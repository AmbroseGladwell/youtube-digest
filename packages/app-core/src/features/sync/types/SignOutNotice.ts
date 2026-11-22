export interface SignOutNotice {
  pending: number;
  stuck: number;
  offline: boolean;
  // Deleted rather than signed out of, so nothing waits and the notice says so instead.
  deleted?: boolean;
}
