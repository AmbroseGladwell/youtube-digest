export interface IndexedDbStoreOptions {
  // Fired after a write whose journal entry landed, so a sync engine can push it without
  // polling. Whether an entry lands at all is the database's decision, not this one's
  // (appendPendingWrite).
  onJournaled?: (() => void) | undefined;
}
