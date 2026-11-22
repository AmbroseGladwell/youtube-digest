import type { PodcastEpisode, TranscriptCheck } from "@overview/domain";
import type { PodcastApi } from "@overview/sync";
import { findEpisodeOnYouTube, type YouTubeFetch } from "@overview/transcripts";

// Without an extension our server searches, which spends one of the app's daily searches.
export const checkEpisodeWords = async (
  api: Pick<PodcastApi, "checkTranscript">,
  episode: PodcastEpisode,
  youTubeFetch: YouTubeFetch | null,
): Promise<TranscriptCheck> => {
  const ask = { feedUrl: episode.feedUrl, guid: episode.guid };
  if (youTubeFetch === null) {
    return api.checkTranscript({ ...ask, searchYouTube: true });
  }
  const checked = await api.checkTranscript(ask);
  if (checked.words !== "none") {
    return checked;
  }
  try {
    const found = await findEpisodeOnYouTube(youTubeFetch, {
      showName: episode.showName,
      title: episode.title,
      durationSeconds: episode.durationSeconds,
      publishedAt: episode.publishedAt,
      keywords: episode.notesKeywords,
    });
    return found === null ? checked : { words: "found" };
  } catch {
    return { words: "unknown" };
  }
};
