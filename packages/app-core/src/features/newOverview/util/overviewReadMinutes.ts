import type { Overview } from "@overview/domain";
import { noteTiming } from "../../reader/util/noteTiming.js";
import { overviewNoteLines } from "../../reader/util/overviewNoteLines.js";

// Deliberately the reader's own arithmetic rather than a second estimate: the receipt the
// progress list prints and the "4 min read" the note shows are then the same number by
// construction (docs/features/overview-redesign.md, "Read and listen times").
export const overviewReadMinutes = (overview: Overview): number =>
  noteTiming(overviewNoteLines(overview)).readMinutes;
