import type { FollowedPlaylist, PlaylistCheck } from "@overview/domain";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const count = (value: number, one: string, many: string) => `${value.toLocaleString("en-GB")} ${value === 1 ? one : many}`;

export function checkedAgo(checkedAt: string, now: Date): string {
  const elapsed = now.getTime() - new Date(checkedAt).getTime();
  if (elapsed < MINUTE_MS) return "Checked just now";
  const format = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  if (elapsed < HOUR_MS) return `Checked ${format.format(-Math.floor(elapsed / MINUTE_MS), "minute")}`;
  if (elapsed < DAY_MS) return `Checked ${format.format(-Math.floor(elapsed / HOUR_MS), "hour")}`;
  return `Checked ${format.format(-Math.floor(elapsed / DAY_MS), "day")}`;
}

// Design 27p: owner, public or unlisted, how many videos this device last saw in it, and how
// many overviews it has given. The video count is this device's last check, so it is left
// out where this device has never checked.
export function followedPlaylistMeta(playlist: FollowedPlaylist, check: PlaylistCheck | null, overviews: number): string {
  return [
    playlist.owner,
    playlist.privacy === "unlisted" ? "Unlisted" : "Public",
    check === null ? null : count(check.seenVideoIds.length, "video", "videos"),
    count(overviews, "overview", "overviews"),
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

export function unavailableLine(playlist: FollowedPlaylist): string | null {
  if (playlist.unavailable === "private") return "Now private on YouTube, so we can’t check it for new videos.";
  if (playlist.unavailable === "gone") return "Gone from YouTube, so we can’t check it for new videos.";
  return null;
}

export function followingRowValue(following: number): string {
  return following === 0 ? "None" : `Following ${following.toLocaleString("en-GB")}`;
}
