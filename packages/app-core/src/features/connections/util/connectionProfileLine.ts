// What a connection can read of what is known about the reader: its scope, then the reader's own
// switch, which turns it off for every connection at once (docs/features/mcp-connector.md,
// "The profile").
export function connectionProfileLine(readsProfile: boolean, sharingProfile: boolean): string {
  if (!readsProfile) return "Can’t read what we know about you until it’s reconnected";
  return sharingProfile ? "Can read what we know about you" : "Can’t read what we know about you: it’s off in Personalisation";
}
