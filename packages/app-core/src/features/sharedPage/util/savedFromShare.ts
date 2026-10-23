import type { Overview, SharedNote } from "@overview/domain";

// A shared copy, become one of the reader's own overviews. The fields it does not carry
// are the ones that were the sharer's to keep, and they start empty rather than borrowed:
// the new reader has not said why they saved it, has no topics yet, did not take it
// from a playlist, and made it on no key of theirs (docs/features/sharing.md).
export const savedFromShare = (note: SharedNote): Overview => ({
  ...note,
  captureReason: null,
  topicIds: [],
  fromPlaylist: null,
  madeOn: null,
});
