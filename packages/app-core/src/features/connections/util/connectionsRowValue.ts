export interface ConnectionsRowState {
  signedIn: boolean;
  isPlus: boolean;
  count: number | undefined;
}

// Design 58i–58r: what the Connections row in Settings says before it is opened.
export function connectionsRowValue({ signedIn, isPlus, count }: ConnectionsRowState): string {
  if (!signedIn) return "Sign in first";
  if (!isPlus) return "Needs Plus";
  if (count === undefined) return "Plus";
  return count === 0 ? "None" : `${count} connected`;
}
