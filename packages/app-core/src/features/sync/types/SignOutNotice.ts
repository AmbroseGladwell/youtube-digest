// What a sign-out left behind in the account's library: writes still queued, writes the
// server refused, and whether the device knew it was offline (design 47d).
export interface SignOutNotice {
  pending: number;
  stuck: number;
  offline: boolean;
}
