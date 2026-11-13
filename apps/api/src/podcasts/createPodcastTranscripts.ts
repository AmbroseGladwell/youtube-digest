import type { FastifyBaseLogger } from "fastify";
import { podcastSourceId, sourceKey, StoredTranscript, VideoId, type PodcastTranscriptLink, type SourceKey } from "@overview/domain";
import {
  confirmEpisodeOnYouTube,
  episodeKeywords,
  findEpisodeOnYouTube,
  TranscriptFetchError,
  TranscriptFetchFailure,
  type EpisodeToFind,
} from "@overview/transcripts";
import type { CostPayer } from "../costs/AccountCostsRepository.js";
import { readBodyText, type createPublicWebFetch } from "../publicWeb/createPublicWebFetch.js";
import type { ServiceCaller, ServiceTranscripts } from "../transcripts/ServiceTranscripts.js";
import { transcriptFault } from "../transcripts/transcriptFault.js";
import type { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";
import { feedItemGuid, fetchFeedEpisode } from "./fetchFeedEpisode.js";
import {
  FORMAT_PREFERENCE,
  parsePodcastTranscript,
  podcastTranscriptFormat,
  type PodcastTranscriptFormat,
} from "./parsePodcastTranscript.js";

export type PodcastTranscriptAnswer =
  | { via: "cache" }
  | { via: "tag"; format: PodcastTranscriptFormat }
  | { via: "youtube"; matchedBy: "title" | "description"; searchedBy: "extension" | "server" };

// How the YouTube rung is asked: with the video a reader's extension found, to be checked, or
// for our server to search itself, when the reader has no extension.
export type YouTubeAsk = { videoId: string } | { search: true } | null;

export interface PodcastTranscriptRequest {
  feedUrl: string;
  guid: string;
  youTube: YouTubeAsk;
  caller: Extract<ServiceCaller, { accountId: unknown }>;
  log: FastifyBaseLogger;
}

export interface PodcastTranscriptsOptions {
  fetchPublicWeb: ReturnType<typeof createPublicWebFetch>;
  transcripts: Pick<TranscriptsRepository, "getShared" | "putServiceFetched">;
  // Our server's YouTube fetching; absent, the YouTube rung can't be asked here.
  youTubeService: Pick<ServiceTranscripts, "resolve" | "onYouTube"> | null;
  clock: () => Date;
}

// The video a reader's extension found isn't the episode by the rules our server checks with, so
// nothing is kept for everyone. The reader can still use the captions it fetched.
export class MatchUnconfirmedError extends TranscriptFetchError {
  constructor() {
    super("That video couldn't be confirmed as this episode", { failure: TranscriptFetchFailure.NO_CAPTIONS, sourceId: "podcast-youtube" });
  }
}

const MOST_TRANSCRIPT_BYTES = 10 * 1024 * 1024;

export const podcastSourceKey = async (episode: { feedUrl: string; guid: string }): Promise<SourceKey> =>
  sourceKey({ kind: "podcast", id: await podcastSourceId(episode) })!;

const byPreference = (links: readonly PodcastTranscriptLink[]) =>
  links
    .flatMap((link) => {
      const format = podcastTranscriptFormat(link.type);
      return format === null ? [] : [{ link, format }];
    })
    .sort((a, b) => FORMAT_PREFERENCE.indexOf(a.format) - FORMAT_PREFERENCE.indexOf(b.format));

const noCaptions = (message: string, sourceId: string) =>
  new TranscriptFetchError(message, { failure: TranscriptFetchFailure.NO_CAPTIONS, sourceId });

// The podcast rungs, each asked only if the one before couldn't answer, and every answer kept
// in the shared cache so an episode is fetched once, ever (docs/features/podcast-transcripts.md,
// docs/features/podcast-on-youtube.md). The episode is read again from its own feed, never taken
// from the caller, and a video a caller names is checked against it by our server, so nothing a
// caller sends decides what is kept under an episode's key.
export function createPodcastTranscripts({ fetchPublicWeb, transcripts, youTubeService, clock }: PodcastTranscriptsOptions) {
  const fromTag = async (key: SourceKey, links: readonly PodcastTranscriptLink[]) => {
    for (const { link, format } of byPreference(links)) {
      const answer = await fetchPublicWeb(link.url, { accept: link.type });
      if (answer.status === "failed") continue;
      const text = await readBodyText(answer.response, MOST_TRANSCRIPT_BYTES).catch(() => null);
      if (text === null) continue;
      const transcript: StoredTranscript = {
        videoId: key,
        segments: parsePodcastTranscript(text, format),
        generated: true,
        fetchedAt: clock().toISOString(),
      };
      if (transcriptFault(transcript, key) === null) return { transcript, format };
    }
    return null;
  };

  const fromYouTube = async (key: SourceKey, episode: EpisodeToFind, ask: Exclude<YouTubeAsk, null>, request: PodcastTranscriptRequest) => {
    if (youTubeService === null) throw noCaptions("Our server doesn't fetch from YouTube", "podcast-youtube");
    const payer: CostPayer = { accountId: request.caller.accountId };
    let found: { videoId: string; matchedBy: "title" | "description"; searchedBy: "extension" | "server" };
    if ("videoId" in ask) {
      const matchedBy = await youTubeService.onYouTube(
        (youTubeFetch) => confirmEpisodeOnYouTube(youTubeFetch, episode, ask.videoId),
        payer,
        request.log,
      );
      if (matchedBy === null) throw new MatchUnconfirmedError();
      found = { videoId: ask.videoId, matchedBy, searchedBy: "extension" };
    } else {
      const match = await youTubeService.onYouTube((youTubeFetch) => findEpisodeOnYouTube(youTubeFetch, episode), payer, request.log);
      if (match === null) throw noCaptions("The episode isn't on its show's YouTube channel", "podcast-youtube");
      found = { videoId: match.videoId, matchedBy: match.via, searchedBy: "server" };
    }
    const captions = await youTubeService.resolve(VideoId.parse(found.videoId), request.caller, request.log);
    const transcript: StoredTranscript = {
      videoId: key,
      segments: captions.transcript.segments,
      generated: captions.transcript.generated,
      fetchedAt: clock().toISOString(),
    };
    if (transcriptFault(transcript, key) !== null) throw noCaptions("The video's captions couldn't be read", "podcast-youtube");
    return { transcript, answer: { via: "youtube" as const, matchedBy: found.matchedBy, searchedBy: found.searchedBy } };
  };

  return async function resolvePodcastTranscript(
    request: PodcastTranscriptRequest,
  ): Promise<{ transcript: StoredTranscript; answer: PodcastTranscriptAnswer }> {
    const key = await podcastSourceKey(request);
    const cached = StoredTranscript.safeParse(await transcripts.getShared(key));
    if (cached.success) return { transcript: cached.data, answer: { via: "cache" } };

    const read = await fetchFeedEpisode(fetchPublicWeb, request.feedUrl, (item) => feedItemGuid(item) === request.guid);
    if (read.status === "failed") {
      throw new TranscriptFetchError("The show's feed couldn't be read", {
        failure: TranscriptFetchFailure.SOURCE_UNAVAILABLE,
        sourceId: "podcast-feed",
      });
    }
    const { item, show, neighbourNotes } = read.feed;
    if (item === null) {
      throw new TranscriptFetchError("The episode isn't in its show's feed", {
        failure: TranscriptFetchFailure.VIDEO_UNAVAILABLE,
        sourceId: "podcast-feed",
      });
    }

    const tagged = await fromTag(key, item.transcripts);
    if (tagged !== null) {
      await transcripts.putServiceFetched(tagged.transcript);
      return { transcript: tagged.transcript, answer: { via: "tag", format: tagged.format } };
    }
    if (request.youTube === null || item.title === null || show.title === null) {
      throw noCaptions("The episode's feed offers no transcript we can read", "podcast-tag");
    }
    const episode: EpisodeToFind = {
      showName: show.title,
      title: item.title,
      durationSeconds: item.durationSeconds,
      publishedAt: item.publishedAt,
      keywords: episodeKeywords(item.notes, neighbourNotes),
    };
    const answered = await fromYouTube(key, episode, request.youTube, request);
    await transcripts.putServiceFetched(answered.transcript);
    return answered;
  };
}
