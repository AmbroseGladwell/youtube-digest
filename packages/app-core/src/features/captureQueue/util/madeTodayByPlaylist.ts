import { sourceKey, type Overview } from "@overview/domain";

export const localDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const nextLocalMidnight = (now: Date): Date => {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
};

// What counts as made today, and why: docs/features/playlists.md, "A pace for each playlist".
export const madeTodayByPlaylist = (overviews: readonly Overview[], chosen: ReadonlySet<string>, now: Date): Map<string, number> => {
  const today = localDayKey(now);
  const counts = new Map<string, number>();
  for (const overview of overviews) {
    if (overview.fromPlaylist === null || localDayKey(new Date(overview.savedAt)) !== today) {
      continue;
    }
    const key = sourceKey(overview.source);
    if (key !== null && chosen.has(key)) {
      continue;
    }
    counts.set(overview.fromPlaylist.id, (counts.get(overview.fromPlaylist.id) ?? 0) + 1);
  }
  return counts;
};
