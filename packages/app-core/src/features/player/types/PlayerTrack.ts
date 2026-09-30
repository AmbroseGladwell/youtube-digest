import type { NoteLine, OverviewId, SharedNote } from "@overview/domain";
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

// Takes SharedNote so a shared copy makes the same track from the same fields: none of
// the three an Overview has on top of it is played or named (docs/features/sharing.md).
export function playerTrackFor(overview: SharedNote, lines: NoteLine[] = overviewNoteLines(overview)): PlayerTrack {
  return {
    overviewId: overview.id,
    title: overview.video.title,
    channel: overview.video.channel,
    artworkUrl: overview.video.thumbnailUrl ?? null,
    lines,
  };
}
