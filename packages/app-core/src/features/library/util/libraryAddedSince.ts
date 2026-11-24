import type { LibraryAdded } from "../types/LibraryFilters.js";

// The device's clock and time zone, never a model's: docs/features/library-filters.md, "Added".
export const libraryAddedSince = (added: LibraryAdded, now: Date): number | null => {
  const since = new Date(now);
  switch (added) {
    case "any":
      return null;
    case "today":
      since.setHours(0, 0, 0, 0);
      break;
    case "7d":
      since.setDate(since.getDate() - 7);
      break;
    case "30d":
      since.setDate(since.getDate() - 30);
      break;
    case "3m":
      since.setMonth(since.getMonth() - 3);
      break;
    case "6m":
      since.setMonth(since.getMonth() - 6);
      break;
  }
  return since.getTime();
};
