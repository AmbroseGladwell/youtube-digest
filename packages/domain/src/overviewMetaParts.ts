import { noteTiming } from "./noteTiming.js";
import type { SharedNote } from "./SharedNote.js";
import { overviewNoteLines } from "./overviewNoteLines.js";
import { readerMetaParts } from "./readerMetaParts.js";

// "4 min read · 6 min listen · 11:38 video", for every place that prints it: a library row,
// the note that row opens, and the shared page and its link preview, which the API builds
// from the same arithmetic rather than a second estimate that can drift
// (docs/features/overview-redesign.md, "Read and listen times"; docs/features/sharing.md).
export const overviewMetaParts = (overview: SharedNote): string[] =>
  readerMetaParts(noteTiming(overviewNoteLines(overview)), overview.video.durationMs);
