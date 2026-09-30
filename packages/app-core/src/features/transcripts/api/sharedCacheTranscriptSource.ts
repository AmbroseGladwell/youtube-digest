import { VideoId } from "@overview/domain";
import type { SharedTranscriptApi } from "@overview/sync";
import { extractYouTubeVideoId } from "../../newOverview/util/parseYouTubeUrl.js";
import type { TranscriptSource } from "../types/TranscriptSource.js";

// A cache, so whatever goes wrong asking it is a miss: the next rung is asked and nothing
// is said about it to the reader (docs/features/shared-transcript-cache.md).
export const sharedCacheTranscriptSource = (api: SharedTranscriptApi): TranscriptSource => ({
  tier: "shared-cache",
  cost: "free",
  isReady: () => Promise.resolve(true),
  resolve: async (url) => {
    const videoId = extractYouTubeVideoId(url);
    if (videoId === null) return null;

    const shared = await api.get(VideoId.parse(videoId)).catch(() => null);
    if (!shared?.video) return null;
    return { video: { ...shared.video, url }, transcript: shared.segments, generated: shared.generated };
  },
});
