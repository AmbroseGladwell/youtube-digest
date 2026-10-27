import { paceDailyLimit, type PlaylistId, type PlaylistPace, type QueuedCapture } from "@overview/domain";
import { paceInASentence } from "../../playlists/util/paceCopy.js";

type PaceOf = (playlistId: PlaylistId) => PlaylistPace;

// The pace never changes by making videos now, and the words say so (95af–95ai).
function paceStays(captures: readonly QueuedCapture[], paceOf: PaceOf): string {
  const playlists = [...new Map(captures.map((capture) => [capture.fromPlaylist.id, capture.fromPlaylist])).values()];
  if (playlists.length !== 1) return "Paces stay as they are.";
  const [playlist] = playlists as [QueuedCapture["fromPlaylist"]];
  const pace = paceOf(playlist.id);
  return paceDailyLimit(pace) === 0
    ? `The rest of ${playlist.title} keep waiting for you.`
    : `${playlist.title} stays at ${paceInASentence(pace)}.`;
}

export function chosenBarLine(captures: readonly QueuedCapture[], paceOf: PaceOf): string {
  return `Made next, oldest first. ${paceStays(captures, paceOf)}`;
}

export function madeNowNotice(captures: readonly QueuedCapture[], paceOf: PaceOf): { lead: string; rest: string } {
  const lead = captures.length === 1 ? `Making “${captures[0]!.title}” next.` : `Making ${captures.length.toLocaleString("en-GB")} next.`;
  return { lead, rest: paceStays(captures, paceOf) };
}

export function makeChosenLabel(count: number): string {
  return count === 1 ? "Make it now" : `Make ${count.toLocaleString("en-GB")} now`;
}
