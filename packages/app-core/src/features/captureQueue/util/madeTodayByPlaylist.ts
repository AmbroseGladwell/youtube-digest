import type { Overview } from "@overview/domain";

// The reader's own day, in their clock: a pace starts again at local midnight.
export const localDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function nextLocalMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

// How many overviews each followed playlist has given today, counted from the library so
// every device counts the same. A video the reader chose to make now never counts toward its
// playlist's pace, and one made by hand has no playlist (docs/features/capture-queue.md,
// "Waiting on a pace").
export function madeTodayByPlaylist(overviews: readonly Overview[], chosen: ReadonlySet<string>, now: Date): Map<string, number> {
  const today = localDayKey(now);
  const counts = new Map<string, number>();
  for (const overview of overviews) {
    if (overview.fromPlaylist === null || localDayKey(new Date(overview.savedAt)) !== today) continue;
    if (overview.video.id !== null && chosen.has(overview.video.id)) continue;
    counts.set(overview.fromPlaylist.id, (counts.get(overview.fromPlaylist.id) ?? 0) + 1);
  }
  return counts;
}
