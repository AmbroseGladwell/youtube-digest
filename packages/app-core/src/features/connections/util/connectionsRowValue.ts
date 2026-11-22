export interface ConnectionsRowState {
  signedIn: boolean;
  accountUnreachable: boolean;
  count: number | undefined;
  countFailed: boolean;
}

export const CHECKING_ROW_VALUE = "Checking…";
export const UNREACHABLE_ROW_VALUE = "Couldn't check";

// What isn't known yet is said as such rather than guessed as none.
export const connectionsRowValue = ({ signedIn, accountUnreachable, count, countFailed }: ConnectionsRowState): string => {
  if (!signedIn) {
    return "Sign in first";
  }
  if (accountUnreachable) {
    return UNREACHABLE_ROW_VALUE;
  }
  if (count === undefined) {
    return countFailed ? UNREACHABLE_ROW_VALUE : CHECKING_ROW_VALUE;
  }
  return count === 0 ? "None" : `${count} connected`;
};
