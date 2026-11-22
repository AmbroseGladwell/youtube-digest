import type { NoteLine, OverviewId, SharedNote } from "@overview/domain";
import { overviewNoteLines, spokenOpening, sourceName, sourceImage } from "@overview/domain";

// The opening is narrated but shown nowhere: docs/features/tts-pre-rendered-speech.md, "The spoken script".
export interface PlayerTrack {
  overviewId: OverviewId;
  title: string;
  channel: string;
  artworkUrl: string | null;
  opening: string | null;
  lines: NoteLine[];
}

// Takes SharedNote so a shared copy makes the same track as the overview it was shared from.
export const playerTrackFor = (overview: SharedNote, lines: NoteLine[] = overviewNoteLines(overview)): PlayerTrack => {
  return {
    overviewId: overview.id,
    title: overview.source.title,
    channel: sourceName(overview.source),
    artworkUrl: sourceImage(overview.source),
    opening: spokenOpening(overview.source),
    lines,
  };
};
