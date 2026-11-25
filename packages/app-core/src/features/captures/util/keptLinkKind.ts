import { parseTikTokLink, type KeptCapture } from "@overview/domain";
import { isYouTubeUrl } from "../../newOverview/util/parseYouTubeUrl.js";

export type KeptLinkKind = "youtube" | "podcast" | "tiktok" | "article";

// How a kept link is made, from what it is: docs/features/kept-links.md, "Kept links".
export const keptLinkKind = (link: Pick<KeptCapture, "url" | "source">): KeptLinkKind => {
  if (link.source?.kind === "podcast") {
    return "podcast";
  }
  if (isYouTubeUrl(link.url)) {
    return "youtube";
  }
  return parseTikTokLink(link.url) === null ? "article" : "tiktok";
};
