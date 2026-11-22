export interface IndexedDbStoreOptions {
  // Whether an entry lands at all is appendPendingWrite's decision, not this one's.
  onJournaled?: (() => void) | undefined;
}
