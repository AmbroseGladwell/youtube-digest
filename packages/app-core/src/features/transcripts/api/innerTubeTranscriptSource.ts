import { fetchInnerTubeTranscript, type YouTubeFetch } from "@overview/transcripts";
import { extractYouTubeVideoId } from "../../newOverview/util/parseYouTubeUrl.js";
import type { TranscriptSource } from "../types/TranscriptSource.js";

export const innerTubeTranscriptSource = (youTubeFetch: YouTubeFetch): TranscriptSource => ({
  tier: "extension",
  cost: "free",
  isReady: () => Promise.resolve(true),
  resolve: async (url) => {
    const videoId = extractYouTubeVideoId(url);
    if (videoId === null) {
      return null;
    }

    const fetched = await fetchInnerTubeTranscript(youTubeFetch, videoId, url);
    return { video: fetched.video, transcript: fetched.transcript, generated: fetched.generated };
  },
});
