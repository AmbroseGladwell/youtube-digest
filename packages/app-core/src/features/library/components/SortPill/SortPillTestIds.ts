import type { LibrarySort } from "../../types/LibrarySort.js";

export const sortPillTestIds = {
  trigger: "SortPill.trigger",
  menu: "SortPill.menu",
  option: (sort: LibrarySort) => `SortPill.option.${sort}`,
};
