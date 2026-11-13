import type { YouTubeFetch } from "../YouTubeFetch.js";
import { DEFAULT_METADATA_CLIENT, type InnerTubeClientConfig } from "../innertube/InnerTubeClientConfig.js";
import { requestPlayerResponse } from "../innertube/requestPlayerResponse.js";
import {
  daysAgo,
  descriptionShare,
  DESCRIPTION_WORDS_SHARED,
  FEWEST_KEYWORDS,
  MOST_DAYS_APART,
  retitledLengthMatches,
  titleMatch,
  type EpisodeToFind,
} from "./matchUpload.js";

// Whether one video someone else found is the episode, by the same rules the search uses, from a
// single player response: its title and length, or its description and exact date. There is no
// runner-up to lead here, so a search's lead is taken on trust from whoever searched
// (docs/features/podcast-on-youtube.md, "Checking a match").
export async function confirmEpisodeOnYouTube(
  youTubeFetch: YouTubeFetch,
  episode: EpisodeToFind,
  videoId: string,
  { client = DEFAULT_METADATA_CLIENT, now = () => new Date() }: { client?: InnerTubeClientConfig; now?: () => Date } = {},
): Promise<"title" | "description" | null> {
  const player = await requestPlayerResponse(youTubeFetch, videoId, client);
  const details = player.videoDetails;
  const seconds = Number(details?.lengthSeconds);
  if (details?.videoId !== undefined && details.videoId !== videoId) return null;
  const upload = {
    videoId,
    title: details?.title ?? "",
    lengthSeconds: Number.isInteger(seconds) && seconds > 0 ? seconds : null,
    age: null,
  };
  if (titleMatch(episode, [upload]) !== null) return "title";

  const published = player.microformat?.playerMicroformatRenderer?.publishDate;
  if (published === undefined || episode.publishedAt === null || episode.keywords.length < FEWEST_KEYWORDS) return null;
  const today = now();
  const sameDays = Math.abs(daysAgo(published, today) - daysAgo(episode.publishedAt, today)) <= MOST_DAYS_APART;
  const sameLength = retitledLengthMatches(episode, upload.lengthSeconds);
  const sameWords = descriptionShare(episode.keywords, details?.shortDescription ?? "") >= DESCRIPTION_WORDS_SHARED;
  return sameDays && sameLength && sameWords ? "description" : null;
}
