import { canonicalArticleUrl, sourceKey, type Overview } from "@overview/domain";
import { extractYouTubeVideoId } from "../../newOverview/util/parseYouTubeUrl.js";
import { readableEntries, type LibraryEntry } from "../types/LibraryEntry.js";
import { orderLibraryEntriesBySavedAt } from "./orderLibraryEntriesBySavedAt.js";

// Why by video id: docs/features/transcript-storage.md, "Where the video id comes from".
export const overviewForVideoUrl = (entries: LibraryEntry[], videoUrl: string | null): Overview | null => {
  if (videoUrl === null) {
    return null;
  }
  const videoId = extractYouTubeVideoId(videoUrl);
  if (videoId === null) {
    return null;
  }
  const match = readableEntries(orderLibraryEntriesBySavedAt(entries)).find(({ overview }) => sourceKey(overview.source) === videoId);
  return match?.overview ?? null;
};

// The run's check on the page's own canonical address catches what the tab's address misses.
export const overviewForPageUrl = (entries: LibraryEntry[], pageUrl: string): Overview | null => {
  const wanted = canonicalArticleUrl(pageUrl, null);
  const match = readableEntries(orderLibraryEntriesBySavedAt(entries)).find(
    ({ overview }) => overview.source.kind === "web" && overview.source.url === wanted,
  );
  return match?.overview ?? null;
};
