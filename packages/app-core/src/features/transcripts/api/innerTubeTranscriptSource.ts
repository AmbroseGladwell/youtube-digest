import { fetchInnerTubeTranscript, type YouTubeFetch } from "@overview/transcripts";
import { extractYouTubeVideoId } from "../../newOverview/util/parseYouTubeUrl.js";
import type { TranscriptSource } from "../types/TranscriptSource.js";

// One player call carries the metadata and the caption tracks together, so there is no
// gap between a cheap half and an expensive one to ask the store about — and nothing to
// spend either way (docs/features/transcript-retrieval.md).
export const innerTubeTranscriptSource = (youTubeFetch: YouTubeFetch): TranscriptSource => ({
  tier: "extension",
  cost: "free",
  isReady: () => Promise.resolve(true),
  resolve: async (url) => {
    const videoId = extractYouTubeVideoId(url);
    // Not a YouTube url, so this rung was never able to answer for it.
    if (videoId === null) return null;

    const fetched = await fetchInnerTubeTranscript(youTubeFetch, videoId, url);
    return { video: fetched.video, transcript: fetched.transcript, generated: fetched.generated };
  },
});
