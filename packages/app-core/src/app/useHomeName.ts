import { useActiveVideoUrl } from "./ActiveVideoContext.js";
import { useActivePage } from "./ArticlePagesContext.js";
import { isOfferedPage } from "./isOfferedPage.js";

export type HomeName = "This video" | "This page" | "Home";

// Follows the tab, not what was there when the reader left home, so the label itself says they moved on.
export const useHomeName = (): HomeName => {
  const activeVideoUrl = useActiveVideoUrl();
  const activePage = useActivePage();
  if (activeVideoUrl !== null) {
    return "This video";
  }
  return isOfferedPage(activePage) ? "This page" : "Home";
};
