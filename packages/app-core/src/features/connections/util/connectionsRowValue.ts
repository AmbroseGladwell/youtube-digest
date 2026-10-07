export interface ConnectionsRowState {
  signedIn: boolean;
  accountUnreachable: boolean;
  count: number | undefined;
  countFailed: boolean;
}

export const CHECKING_ROW_VALUE = "Checking…";
export const UNREACHABLE_ROW_VALUE = "Couldn't check";

// Design 58i–58r: what the Connections row in Settings says before it is opened. Any
// signed-in account can connect (docs/architecture/tiers.md), so a connection belongs to an
// account rather than to a plan, and what is not known yet is said as such rather than
// guessed as none.
export function connectionsRowValue({
  signedIn,
  accountUnreachable,
  count,
  countFailed,
}: ConnectionsRowState): string {
  if (!signedIn) return "Sign in first";
  if (accountUnreachable) return UNREACHABLE_ROW_VALUE;
  if (count === undefined) return countFailed ? UNREACHABLE_ROW_VALUE : CHECKING_ROW_VALUE;
  return count === 0 ? "None" : `${count} connected`;
}
