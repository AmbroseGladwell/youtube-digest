import { z } from "zod";

// How many of a followed playlist's videos the queue makes in a day, or none until the
// reader chooses them (docs/features/playlists.md, "A pace for each playlist").
export const PlaylistPace = z.enum(["asTheyCome", "fiveADay", "oneADay", "whenChosen"]);
export type PlaylistPace = z.infer<typeof PlaylistPace>;

export const DEFAULT_PLAYLIST_PACE: PlaylistPace = "fiveADay";

export const PLAYLIST_PACES: readonly PlaylistPace[] = PlaylistPace.options;

const DAILY_LIMIT: Record<PlaylistPace, number | null> = {
  asTheyCome: null,
  fiveADay: 5,
  oneADay: 1,
  whenChosen: 0,
};

// Null is no daily limit at all: the month's allowance is the only one.
export function paceDailyLimit(pace: PlaylistPace): number | null {
  return DAILY_LIMIT[pace];
}
