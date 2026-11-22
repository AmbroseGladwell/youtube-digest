import type { FastifyBaseLogger } from "fastify";
import {
  type StoredTranscript,
  apiLogLines,
  podcastSourceId,
  sourceKey,
  VideoId,
  type PodcastTranscriptLink,
  type SourceKey,
} from "@overview/domain";
import { episodeKeywords, TranscriptFetchError, TranscriptFetchFailure, type EpisodeToFind } from "@overview/transcripts";
import { readBodyText, type createPublicWebFetch } from "../publicWeb/createPublicWebFetch.js";
import type { ServiceCaller, ServiceTranscripts } from "../transcripts/ServiceTranscripts.js";
import { transcriptFault } from "../transcripts/transcriptFault.js";
import type { EpisodeWordSource, EpisodeWordSources, KnownWordSource } from "./EpisodeWordSourcesRepository.js";
import { feedItemGuid, fetchFeedEpisode } from "./fetchFeedEpisode.js";
import type { YouTubeEpisodes } from "./youTubeDataApiEpisodes.js";
import {
  FORMAT_PREFERENCE,
  parsePodcastTranscript,
  podcastTranscriptFormat,
  type PodcastTranscriptFormat,
} from "./parsePodcastTranscript.js";

export type PodcastTranscriptAnswer =
  | { via: "remembered"; from: EpisodeWordSource["via"] }
  | { via: "tag"; format: PodcastTranscriptFormat }
  | { via: "youtube"; matchedBy: "title" | "description"; searchedBy: "extension" | "server" };

export type YouTubeAsk = { videoId: string } | { search: true } | null;

export interface PodcastTranscriptRequest {
  feedUrl: string;
  guid: string;
  youTube: YouTubeAsk;
  caller: ServiceCaller;
  log: FastifyBaseLogger;
}

// What each answer means: docs/features/speech-to-text.md, "The server rung".
export type PodcastTranscriptCheck =
  | { words: "found"; via: "remembered" | "tag" | "youtube" }
  | { words: "none"; episode: { sourceKey: SourceKey; durationSeconds: number | null; audioUrl: string | null } }
  | { words: "unknown"; via: "feed" | "youtube" };

export type PodcastTranscriptCheckRequest = Omit<PodcastTranscriptRequest, "caller">;

export interface PodcastTranscriptsOptions {
  fetchPublicWeb: ReturnType<typeof createPublicWebFetch>;
  sources: EpisodeWordSources;
  youTubeService: Pick<ServiceTranscripts, "resolve"> | null;
  youTubeEpisodes: YouTubeEpisodes | null;
  clock: () => Date;
}

export class MatchUnconfirmedError extends TranscriptFetchError {
  constructor() {
    super("That video couldn't be confirmed as this episode", { failure: TranscriptFetchFailure.NO_CAPTIONS, sourceId: "podcast-youtube" });
  }
}

const MOST_TRANSCRIPT_BYTES = 10 * 1024 * 1024;
// Why 30 days: docs/features/podcast-on-youtube.md, "Keeping a match".
const MATCH_KEPT_MS = 30 * 24 * 60 * 60 * 1000;

export interface FeedEpisode {
  feedUrl: string;
  guid: string;
}

export const podcastSourceKey = async (episode: FeedEpisode): Promise<SourceKey> =>
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

const dataApiUnavailable = (error: unknown): never => {
  throw new TranscriptFetchError("YouTube couldn't be searched just now", {
    failure: TranscriptFetchFailure.SOURCE_UNAVAILABLE,
    sourceId: "podcast-youtube",
    cause: error,
  });
};

export interface ResolvedTranscript {
  transcript: StoredTranscript;
  answer: PodcastTranscriptAnswer;
}

// Why only where the words are is kept: docs/features/podcast-transcripts.md, "Each reader's own copy".
export const createPodcastTranscripts = ({
  fetchPublicWeb,
  sources,
  youTubeService,
  youTubeEpisodes,
  clock,
}: PodcastTranscriptsOptions) => {
  const isFresh = (known: KnownWordSource) => known.source.via === "tag" || clock().getTime() - known.foundAt.getTime() < MATCH_KEPT_MS;

  const captionsOf = async (key: SourceKey, videoId: string, caller: ServiceCaller, log: FastifyBaseLogger) => {
    if (youTubeService === null) {
      throw noCaptions("Our server doesn't fetch from YouTube", "podcast-youtube");
    }
    const captions = await youTubeService.resolve(VideoId.parse(videoId), caller, log);
    const transcript: StoredTranscript = {
      videoId: key,
      segments: captions.transcript.segments,
      generated: captions.transcript.generated,
      fetchedAt: clock().toISOString(),
    };
    if (transcriptFault(transcript, key) !== null) {
      throw noCaptions("The video's captions couldn't be read", "podcast-youtube");
    }
    return transcript;
  };

  const fromTag = async (key: SourceKey, links: readonly PodcastTranscriptLink[]) => {
    for (const { link, format } of byPreference(links)) {
      const answer = await fetchPublicWeb(link.url, { accept: link.type });
      if (answer.status === "failed") {
        continue;
      }
      const text = await readBodyText(answer.response, MOST_TRANSCRIPT_BYTES).catch(() => null);
      if (text === null) {
        continue;
      }
      const transcript: StoredTranscript = {
        videoId: key,
        segments: parsePodcastTranscript(text, format),
        generated: true,
        fetchedAt: clock().toISOString(),
      };
      if (transcriptFault(transcript, key) === null) {
        return { transcript, format, link };
      }
    }
    return null;
  };

  const fromYouTube = async (key: SourceKey, episode: EpisodeToFind, ask: Exclude<YouTubeAsk, null>, request: PodcastTranscriptRequest) => {
    if (youTubeService === null || youTubeEpisodes === null) {
      throw noCaptions("Our server doesn't fetch from YouTube", "podcast-youtube");
    }
    let found: { videoId: string; matchedBy: "title" | "description"; searchedBy: "extension" | "server" };
    if ("videoId" in ask) {
      const matchedBy = await youTubeEpisodes.confirm(episode, ask.videoId).catch(dataApiUnavailable);
      if (matchedBy === null) {
        throw new MatchUnconfirmedError();
      }
      found = { videoId: ask.videoId, matchedBy, searchedBy: "extension" };
    } else {
      const search = await youTubeEpisodes.find(episode).catch(dataApiUnavailable);
      request.log.info(
        apiLogLines.podcasts.youTubeSearched({ units: search.units, searches: search.searches, found: search.found !== null }),
      );
      if (search.found === null) {
        throw noCaptions("The episode isn't on its show's YouTube channel", "podcast-youtube");
      }
      found = { videoId: search.found.videoId, matchedBy: search.found.via, searchedBy: "server" };
    }
    return {
      transcript: await captionsOf(key, found.videoId, request.caller, request.log),
      videoId: found.videoId,
      answer: { via: "youtube" as const, matchedBy: found.matchedBy, searchedBy: found.searchedBy },
    };
  };

  const recheckExpiredMatch = async (key: SourceKey, episode: EpisodeToFind, videoId: string, request: PodcastTranscriptRequest) => {
    if (youTubeEpisodes === null || (await youTubeEpisodes.confirm(episode, videoId).catch(() => null)) === null) {
      return null;
    }
    const transcript = await captionsOf(key, videoId, request.caller, request.log).catch(() => null);
    if (transcript !== null) {
      await sources.put(key, { via: "youtube", videoId }, clock());
    }
    return transcript;
  };

  const fromSource = async (
    key: SourceKey,
    source: EpisodeWordSource,
    caller: ServiceCaller,
    log: FastifyBaseLogger,
  ): Promise<StoredTranscript | null> => {
    if (source.via === "tag") {
      return (await fromTag(key, [{ url: source.url, type: source.type, language: null }]))?.transcript ?? null;
    }
    return captionsOf(key, source.videoId, caller, log).catch(() => null);
  };

  // By key alone, for another device: docs/features/podcast-transcripts.md, "Each reader's own copy".
  const remembered = async (key: SourceKey, caller: ServiceCaller, log: FastifyBaseLogger): Promise<StoredTranscript | null> => {
    const known = await sources.get(key);
    return known === null || !isFresh(known) ? null : fromSource(key, known.source, caller, log);
  };

  const resolve = async (request: PodcastTranscriptRequest): Promise<ResolvedTranscript> => {
    const key = await podcastSourceKey(request);
    const known = await sources.get(key);
    if (known !== null && isFresh(known)) {
      const words = await fromSource(key, known.source, request.caller, request.log);
      if (words !== null) {
        return { transcript: words, answer: { via: "remembered", from: known.source.via } };
      }
      await sources.forget(key);
    }
    const toRefresh = known !== null && !isFresh(known) && known.source.via === "youtube" ? known.source.videoId : null;

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
      await sources.put(key, { via: "tag", url: tagged.link.url, type: tagged.link.type }, clock());
      return { transcript: tagged.transcript, answer: { via: "tag", format: tagged.format } };
    }
    if (item.title === null || show.title === null) {
      throw noCaptions("The episode's feed offers no transcript we can read", "podcast-tag");
    }
    const episode: EpisodeToFind = {
      showName: show.title,
      title: item.title,
      durationSeconds: item.durationSeconds,
      publishedAt: item.publishedAt,
      keywords: episodeKeywords(item.notes, neighbourNotes),
    };
    if (toRefresh !== null) {
      const words = await recheckExpiredMatch(key, episode, toRefresh, request);
      if (words !== null) {
        return { transcript: words, answer: { via: "remembered", from: "youtube" } };
      }
      await sources.forget(key);
    }
    if (request.youTube === null) {
      throw noCaptions("The episode's feed offers no transcript we can read", "podcast-tag");
    }
    const answered = await fromYouTube(key, episode, request.youTube, request);
    await sources.put(key, { via: "youtube", videoId: answered.videoId }, clock());
    return { transcript: answered.transcript, answer: answered.answer };
  };

  const check = async (request: PodcastTranscriptCheckRequest): Promise<PodcastTranscriptCheck> => {
    const key = await podcastSourceKey(request);
    const known = await sources.get(key);
    if (known !== null && isFresh(known)) {
      return { words: "found", via: "remembered" };
    }

    const read = await fetchFeedEpisode(fetchPublicWeb, request.feedUrl, (item) => feedItemGuid(item) === request.guid);
    if (read.status === "failed" || read.feed.item === null) {
      return { words: "unknown", via: "feed" };
    }
    const { item, show, neighbourNotes } = read.feed;
    if (byPreference(item.transcripts).length > 0) {
      return { words: "found", via: "tag" };
    }
    const none = {
      words: "none" as const,
      episode: { sourceKey: key, durationSeconds: item.durationSeconds, audioUrl: item.audioUrl },
    };
    if (item.title === null || show.title === null || youTubeEpisodes === null || youTubeService === null) {
      return none;
    }
    const episode: EpisodeToFind = {
      showName: show.title,
      title: item.title,
      durationSeconds: item.durationSeconds,
      publishedAt: item.publishedAt,
      keywords: episodeKeywords(item.notes, neighbourNotes),
    };
    try {
      const stale = known !== null && known.source.via === "youtube" ? known.source.videoId : null;
      if (stale !== null && (await youTubeEpisodes.confirm(episode, stale)) !== null) {
        await sources.put(key, { via: "youtube", videoId: stale }, clock());
        return { words: "found", via: "youtube" };
      }
      if (request.youTube === null) {
        return none;
      }
      // The extension's own video is the reader's to fetch captions from even unconfirmed, as in Create.
      if ("videoId" in request.youTube) {
        return { words: "found", via: "youtube" };
      }
      const search = await youTubeEpisodes.find(episode);
      request.log.info(
        apiLogLines.podcasts.youTubeSearched({ units: search.units, searches: search.searches, found: search.found !== null }),
      );
      if (search.found === null) {
        return none;
      }
      await sources.put(key, { via: "youtube", videoId: search.found.videoId }, clock());
      return { words: "found", via: "youtube" };
    } catch {
      return { words: "unknown", via: "youtube" };
    }
  };

  return { resolve, remembered, check };
};
