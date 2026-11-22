import type { Overview, SharedNote } from "@overview/domain";

// The sharer's own fields start empty rather than borrowed; a sample is marked, so it isn't their first.
export const savedFromShare = (note: SharedNote, sample = false): Overview => ({
  ...note,
  ...(sample ? { fromSample: true as const } : {}),
  captureReason: null,
  topicIds: [],
  fromPlaylist: null,
  madeOn: null,
  bigPicture: note.bigPicture ?? null,
  followUpQuestions: null,
  sourceSteps: note.sourceSteps ?? null,
  article: note.article ?? null,
  recipe: note.recipe ?? null,
});
