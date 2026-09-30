import type { NoteLine, Overview, OverviewId } from "@overview/domain";
import { overviewNoteLines } from "@overview/domain";

// What the player plays and what the lock screen names: one note, its lines, and the
// video it came from.
export interface PlayerTrack {
  overviewId: OverviewId;
  title: string;
  channel: string;
  artworkUrl: string | null;
  lines: NoteLine[];
}

export function playerTrackFor(overview: Overview, lines: NoteLine[] = overviewNoteLines(overview)): PlayerTrack {
  return {
    overviewId: overview.id,
    title: overview.video.title,
    channel: overview.video.channel,
    artworkUrl: overview.video.thumbnailUrl ?? null,
    lines,
  };
}
