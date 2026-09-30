import type { Overview, SharedNote } from "@overview/domain";

// A shared copy, become one of the reader's own overviews. The two fields it does not
// carry are the two that were the sharer's to keep, and they start empty rather than
// borrowed: the new reader has not said why they saved it, and has no topics yet
// (docs/features/sharing.md).
export const savedFromShare = (note: SharedNote): Overview => ({
  ...note,
  captureReason: null,
  topicIds: [],
});
