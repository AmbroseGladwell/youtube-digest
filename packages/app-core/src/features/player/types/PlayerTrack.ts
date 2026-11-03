import type { NoteLine, OverviewId, SharedNote } from "@overview/domain";
import { overviewNoteLines, spokenOpening, sourceName, sourceImage } from "@overview/domain";

// What the player plays and what the lock screen names: one note, its lines, and the
// video it came from. The opening is narrated before the first line and shown nowhere
// (docs/features/tts-pre-rendered-speech.md, "The spoken script").
export interface PlayerTrack {
  overviewId: OverviewId;
  title: string;
  channel: string;
  artworkUrl: string | null;
  opening: string | null;
  lines: NoteLine[];
  // A recipe's list read aloud on its own, for cooking, rather than the note's narration
  // (design 144t). Absent on the note itself.
  part?: RecipePart;
}

export type RecipePart = "ingredients" | "method";

// Takes SharedNote so a shared copy makes the same track from the same fields: none of
// the three an Overview has on top of it is played or named (docs/features/sharing.md).
export function playerTrackFor(overview: SharedNote, lines: NoteLine[] = overviewNoteLines(overview)): PlayerTrack {
  return {
    overviewId: overview.id,
    title: overview.source.title,
    channel: sourceName(overview.source),
    artworkUrl: sourceImage(overview.source),
    opening: spokenOpening(overview.source),
    lines,
  };
}
