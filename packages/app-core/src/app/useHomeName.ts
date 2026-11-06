import { useActiveVideoUrl } from "./ActiveVideoContext.js";
import { useActivePage } from "./ArticlePagesContext.js";
import { isOfferedPage } from "./isOfferedPage.js";

export type HomeName = "This video" | "This page" | "Home";

// What the panel's home is about right now, which is what every way back to it is named
// after (design 205c). It follows the tab, not what was there when the reader left home, so
// a reader who has moved on is told by the label itself.
export function useHomeName(): HomeName {
  const activeVideoUrl = useActiveVideoUrl();
  const activePage = useActivePage();
  if (activeVideoUrl !== null) return "This video";
  return isOfferedPage(activePage) ? "This page" : "Home";
}
