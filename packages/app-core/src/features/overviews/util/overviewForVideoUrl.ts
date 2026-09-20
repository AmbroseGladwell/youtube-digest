import type { Overview } from "@overview/types";
import { extractYouTubeVideoId } from "../../newOverview/util/parseYouTubeUrl.js";
import type { OverviewWithState } from "../types/OverviewWithState.js";
import { orderOverviewsBySavedAt } from "./orderOverviewsBySavedAt.js";

// Matched on the video's own id rather than on the url, because youtu.be/X and
// watch?v=X&t=30 are the same video and the stored url is whichever one was pasted
// (docs/features/transcript-storage.md, "Where the video id comes from"). The newest
// note wins: a re-run leaves the older one in the library.
//
// It lives with the overviews rather than in either caller: the panel's capture screen
// and the injected button ask the same question, and both ask it to avoid paying for a
// video twice (docs/features/injected-button.md).
export function overviewForVideoUrl(
  overviewsWithState: OverviewWithState[],
  videoUrl: string | null,
): Overview | null {
  if (videoUrl === null) {
    return null;
  }
  const videoId = extractYouTubeVideoId(videoUrl);
  if (videoId === null) {
    return null;
  }
  const match = orderOverviewsBySavedAt(overviewsWithState).find(
    ({ overview }) => overview.video.id === videoId,
  );
  return match?.overview ?? null;
}
