import { noteTiming, overviewNoteLines, type Overview } from "@overview/domain";

// The reader's own arithmetic, so the receipt and the note's "4 min read" always agree.
export const overviewReadMinutes = (overview: Overview): number => noteTiming(overviewNoteLines(overview)).readMinutes;
