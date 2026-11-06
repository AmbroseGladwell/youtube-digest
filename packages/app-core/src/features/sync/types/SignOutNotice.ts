// What a sign-out left behind in the account's library: writes still queued, writes the
// server refused, and whether the device knew it was offline (design 47d).
export interface SignOutNotice {
  pending: number;
  stuck: number;
  offline: boolean;
  // The account was deleted rather than signed out of, so nothing is waiting to sync and
  // the notice says what happened instead (design 184e).
  deleted?: boolean;
}
