import { noteTiming } from "./noteTiming.js";
import type { SharedNote } from "./SharedNote.js";
import { overviewNoteLines } from "./overviewNoteLines.js";
import { readerMetaParts } from "./readerMetaParts.js";
import { noteSourceLength } from "./sourceFacts.js";

// One arithmetic everywhere, API included: docs/features/overview-redesign.md, "Read and listen times".
export const overviewMetaParts = (overview: SharedNote): string[] =>
  readerMetaParts(noteTiming(overviewNoteLines(overview)), noteSourceLength(overview));
