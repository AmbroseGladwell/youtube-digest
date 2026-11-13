import { TranscriptFetchFailure } from "../TranscriptFetchFailure.js";
import type { YouTubeFetch } from "../YouTubeFetch.js";
import { DEFAULT_METADATA_CLIENT, type InnerTubeClientConfig } from "../innertube/InnerTubeClientConfig.js";
import { httpFailure, innerTubeError } from "../innertube/innerTubeFailure.js";
import { requestPlayerResponse } from "../innertube/requestPlayerResponse.js";
import {
  daysAgo,
  descriptionShare,
  DESCRIPTION_LEAD,
  DESCRIPTION_WORDS_SHARED,
  FEWEST_KEYWORDS,
  MOST_DAYS_APART,
  retitledCandidates,
  titleMatch,
  type EpisodeToFind,
} from "./matchUpload.js";
import { channelsIn, uploadsIn, type ListedChannel, type ListedUpload } from "./youTubeListings.js";

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
const VIDEOS_TAB = "EgZ2aWRlb3PyBgQKAjoA";
const CHANNELS_TRIED = 3;
const MORE_PAGES = 5;
const MOST_DESCRIPTIONS_READ = 5;
const CHANNEL_NAME_WORDS_SHARED = 0.6;

const nameWords = (name: string): string[] =>
  name
    .toLowerCase()
    .split(":")[0]!
    .match(/[a-z0-9]+/g) ?? [];

const namesTheShow = (channel: ListedChannel, showName: string): boolean => {
  const show = nameWords(showName);
  const channelWords = new Set(nameWords(channel.title));
  return show.length > 0 && show.filter((word) => channelWords.has(word)).length / show.length >= CHANNEL_NAME_WORDS_SHARED;
};

// The same episode on the show's own YouTube channel, whose captions cost nothing: by its title
// and length, or, where the upload was retitled, by its description and date. Null when the
// episode isn't there or can't be told apart from its neighbours, since a confident wrong match
// is worse than none (docs/features/podcast-on-youtube.md). At most 14 requests.
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
    if (response.status !== 200) throw innerTubeError(`YouTube's ${endpoint} answered ${response.status}`, httpFailure(response.status));
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

  const channels = channelsIn(await ask("search", { query: episode.showName, params: CHANNELS_FILTER })).slice(0, CHANNELS_TRIED);
  const firstPages: { channel: ListedChannel; uploads: ListedUpload[]; continuation: string | null }[] = [];
  for (const channel of channels) {
    const page = uploadsIn(await ask("browse", { browseId: channel.channelId, params: VIDEOS_TAB }));
    const byTitle = titleMatch(episode, page.uploads);
    if (byTitle !== null) return found(byTitle, channel, "title");
    firstPages.push({ channel, ...page });
  }

  const showChannel = firstPages.find(({ channel }) => namesTheShow(channel, episode.showName));
  if (showChannel === undefined) return null;
  const uploads = [...showChannel.uploads];
  let continuation = showChannel.continuation;
  for (let page = 0; page < MORE_PAGES && continuation !== null; page += 1) {
    const next = uploadsIn(await ask("browse", { continuation }));
    const byTitle = titleMatch(episode, next.uploads);
    if (byTitle !== null) return found(byTitle, showChannel.channel, "title");
    uploads.push(...next.uploads);
    continuation = next.continuation;
  }

  if (episode.keywords.length < FEWEST_KEYWORDS || episode.publishedAt === null) return null;
  const today = now();
  const scored: { upload: ListedUpload; share: number }[] = [];
  for (const upload of retitledCandidates(episode, uploads, today).slice(0, MOST_DESCRIPTIONS_READ)) {
    const player = await requestPlayerResponse(youTubeFetch, upload.videoId, client).catch(() => null);
    const published = player?.microformat?.playerMicroformatRenderer?.publishDate;
    if (published === undefined || Math.abs(daysAgo(published, today) - daysAgo(episode.publishedAt, today)) > MOST_DAYS_APART) continue;
    scored.push({ upload, share: descriptionShare(episode.keywords, player?.videoDetails?.shortDescription ?? "") });
  }
  scored.sort((a, b) => b.share - a.share);
  const [best, runnerUp] = scored;
  if (best === undefined || best.share < DESCRIPTION_WORDS_SHARED) return null;
  if (runnerUp !== undefined && runnerUp.share > best.share - DESCRIPTION_LEAD) return null;
  return found(best.upload, showChannel.channel, "description");
}
