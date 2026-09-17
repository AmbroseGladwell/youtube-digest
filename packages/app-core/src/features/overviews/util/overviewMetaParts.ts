import type { Overview } from "@overview/types";
import { noteTiming } from "../../reader/util/noteTiming.js";
import { overviewNoteLines } from "../../reader/util/overviewNoteLines.js";
import { readerMetaParts } from "../../reader/util/readerMetaParts.js";

// "4 min read · 6 min listen · 11:38 video", for the two places that print it: a library
// row and the note that row opens. It lives here rather than in either of them, and reaches
// into the reader's arithmetic the way overviewReadMinutes does, so a row and its note give
// the same three numbers by construction rather than as two estimates that can drift
// (docs/features/overview-redesign.md, "Read and listen times").
export const overviewMetaParts = (overview: Overview): string[] =>
  readerMetaParts(noteTiming(overviewNoteLines(overview)), overview.video.durationMs);
