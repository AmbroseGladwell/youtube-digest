import type { LibrarySortPreset } from "../../types/LibrarySort.js";

export const sortPillTestIds = {
  trigger: "SortPill.trigger",
  menu: "SortPill.menu",
  option: (preset: LibrarySortPreset) => `SortPill.option.${preset}`,
};
