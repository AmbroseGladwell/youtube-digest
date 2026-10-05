import type { PlaylistEntry } from "@overview/domain";

// The order a playlist's videos are made in: the one added longest ago first, and the
// playlist's own order where YouTube gives no date (docs/features/capture-queue.md).
export function oldestFirst(entries: PlaylistEntry[]): PlaylistEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const byDate = (left.entry.addedAt ?? "").localeCompare(right.entry.addedAt ?? "");
      return byDate !== 0 && left.entry.addedAt !== null && right.entry.addedAt !== null ? byDate : left.index - right.index;
    })
    .map(({ entry }) => entry);
}
