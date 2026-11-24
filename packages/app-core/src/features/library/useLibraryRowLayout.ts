import type { LibraryRowLayout } from "@overview/domain";
import { useMediaQuery } from "../../util/useMediaQuery.js";

const BANNER_QUERY = "(max-width: 29.9375rem)";
const NARROW_ROW_QUERY = "(max-width: 47.9375rem)";

// The same breakpoints as LibraryOverviewCard.module.scss: docs/features/library-row-images.md.
export const useLibraryRowLayout = (): LibraryRowLayout => {
  const banner = useMediaQuery(BANNER_QUERY);
  const narrowRow = useMediaQuery(NARROW_ROW_QUERY);
  if (banner) {
    return "banner";
  }
  return narrowRow ? "narrowRow" : "row";
};
