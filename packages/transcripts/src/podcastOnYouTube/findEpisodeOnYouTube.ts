import { TranscriptFetchFailure } from "../TranscriptFetchFailure.js";
import type { YouTubeFetch } from "../YouTubeFetch.js";
import { DEFAULT_METADATA_CLIENT, type InnerTubeClientConfig } from "../innertube/InnerTubeClientConfig.js";
import { httpFailure, innerTubeError } from "../innertube/innerTubeFailure.js";
import { requestPlayerResponse } from "../innertube/requestPlayerResponse.js";
import {
  descriptionShare,
  DESCRIPTION_LEAD,
  DESCRIPTION_WORDS_SHARED,
  FEWEST_KEYWORDS,
  MOST_DESCRIPTIONS_READ,
  listedNearItsDate,
  namesTheShow,
  publishedNearItsDate,
  retitledCandidates,
  searchedVideoMatch,
  titleMatch,
  type EpisodeToFind,
} from "./matchUpload.js";
import { channelsIn, uploadsIn, videosIn, type ListedChannel, type ListedUpload } from "./youTubeListings.js";

export interface EpisodeOnYouTube {
  videoId: string;
  channelTitle: string;
  via: "title" | "description";
}

export interface FindOptions {
  now?: () => Date;
  client?: InnerTubeClientConfig;
}

const ENDPOINT = "https://www.youtube.com/youtubei/v1/";
const CHANNELS_FILTER = "EgIQAg==";
const VIDEOS_FILTER = "EgIQAQ==";
const VIDEOS_TAB = "EgZ2aWRlb3PyBgQKAjoA";
const CHANNELS_TRIED = 3;
const MORE_PAGES = 5;

// The same episode on YouTube, whose captions cost nothing: first among a video search for its
// title, on any channel by its title, length and date; then on the show's own channel by its title
// and length, or, where the upload was retitled, by its description and date. Null when the
// episode isn't there or can't be told apart from its neighbours, since a confident wrong match
// is worse than none (docs/features/podcast-on-youtube.md). At most 15 requests.
export async function findEpisodeOnYouTube(
  youTubeFetch: YouTubeFetch,
  episode: EpisodeToFind,
  { now = () => new Date(), client = DEFAULT_METADATA_CLIENT }: FindOptions = {},
): Promise<EpisodeOnYouTube | null> {
  const ask = async (endpoint: "search" | "browse", payload: Record<string, unknown>): Promise<unknown> => {
    const response = await youTubeFetch({
      url: `${ENDPOINT}${endpoint}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": client.userAgent,
        "X-YouTube-Client-Name": client.clientName,
        "X-YouTube-Client-Version": client.clientVersion,
      },
      body: JSON.stringify({
        context: { client: { clientName: client.clientName, clientVersion: client.clientVersion, hl: "en", gl: "US" } },
        ...payload,
      }),
    });
    if (response.status !== 200) {
      throw innerTubeError(`YouTube's ${endpoint} answered ${response.status}`, httpFailure(response.status));
    }
    try {
      return JSON.parse(response.body);
    } catch (error) {
      throw innerTubeError(
        `YouTube's ${endpoint} answered with something that was not JSON`,
        TranscriptFetchFailure.MALFORMED_RESPONSE,
        error,
      );
    }
  };

  const found = (upload: ListedUpload, channel: ListedChannel, via: EpisodeOnYouTube["via"]): EpisodeOnYouTube => ({
    videoId: upload.videoId,
    channelTitle: channel.title,
    via,
  });

  const today = now();
  const searched = videosIn(await ask("search", { query: `${episode.showName} ${episode.title}`, params: VIDEOS_FILTER }));
  const byVideo = searchedVideoMatch(episode, searched, (video) => listedNearItsDate(episode, video, today));
  if (byVideo !== null) {
    return { videoId: byVideo.videoId, channelTitle: byVideo.channelTitle, via: "title" };
  }

  const channels = channelsIn(await ask("search", { query: episode.showName, params: CHANNELS_FILTER })).slice(0, CHANNELS_TRIED);
  const firstPages: { channel: ListedChannel; uploads: ListedUpload[]; continuation: string | null }[] = [];
  for (const channel of channels) {
    const page = uploadsIn(await ask("browse", { browseId: channel.channelId, params: VIDEOS_TAB }));
    const byTitle = titleMatch(episode, page.uploads);
    if (byTitle !== null) {
      return found(byTitle, channel, "title");
    }
    firstPages.push({ channel, ...page });
  }

  const showChannel = firstPages.find(({ channel }) => namesTheShow(channel.title, episode.showName));
  if (showChannel === undefined) {
    return null;
  }
  const uploads = [...showChannel.uploads];
  let continuation = showChannel.continuation;
  for (let page = 0; page < MORE_PAGES && continuation !== null; page += 1) {
    const next = uploadsIn(await ask("browse", { continuation }));
    const byTitle = titleMatch(episode, next.uploads);
    if (byTitle !== null) {
      return found(byTitle, showChannel.channel, "title");
    }
    uploads.push(...next.uploads);
    continuation = next.continuation;
  }

  if (episode.keywords.length < FEWEST_KEYWORDS || episode.publishedAt === null) {
    return null;
  }
  const scored: { upload: ListedUpload; share: number }[] = [];
  for (const upload of retitledCandidates(episode, uploads, today).slice(0, MOST_DESCRIPTIONS_READ)) {
    const player = await requestPlayerResponse(youTubeFetch, upload.videoId, client).catch(() => null);
    const published = player?.microformat?.playerMicroformatRenderer?.publishDate;
    if (!publishedNearItsDate(episode, published ?? null, today)) {
      continue;
    }
    scored.push({ upload, share: descriptionShare(episode.keywords, player?.videoDetails?.shortDescription ?? "") });
  }
  scored.sort((a, b) => b.share - a.share);
  const [best, runnerUp] = scored;
  if (best === undefined || best.share < DESCRIPTION_WORDS_SHARED) {
    return null;
  }
  if (runnerUp !== undefined && runnerUp.share > best.share - DESCRIPTION_LEAD) {
    return null;
  }
  return found(best.upload, showChannel.channel, "description");
}
