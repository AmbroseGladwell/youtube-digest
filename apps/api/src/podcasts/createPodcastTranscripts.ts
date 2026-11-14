import type { FastifyBaseLogger } from "fastify";
import {
  apiLogLines,
  podcastSourceId,
  sourceKey,
  StoredTranscript,
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

// How the YouTube rung is asked: with the video a reader's extension found, to be checked, or
// for our server to search itself, when the reader has no extension.
export type YouTubeAsk = { videoId: string } | { search: true } | null;

export interface PodcastTranscriptRequest {
  feedUrl: string;
  guid: string;
  youTube: YouTubeAsk;
  // An account, or signed out the address a trial asks from, as our server's YouTube fetching
  // counts either (docs/features/server-side-transcripts.md).
  caller: ServiceCaller;
  log: FastifyBaseLogger;
}

export interface PodcastTranscriptsOptions {
  fetchPublicWeb: ReturnType<typeof createPublicWebFetch>;
  sources: EpisodeWordSources;
  // Our server's caption fetching; absent, the YouTube rung can't be asked here.
  youTubeService: Pick<ServiceTranscripts, "resolve"> | null;
  // Finding and checking the episode's video through the YouTube Data API; absent, the same.
  youTubeEpisodes: YouTubeEpisodes | null;
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
// The Data API's policies have what it answered refreshed or deleted within 30 days, and a video
// matched to an episode was checked by it, so a match older than that is checked again
// (docs/features/podcast-on-youtube.md, "Keeping a match").
const MATCH_KEPT_MS = 30 * 24 * 60 * 60 * 1000;

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

// The Data API refused or didn't answer, most likely because the day's quota is spent.
const dataApiUnavailable = (error: unknown): never => {
  throw new TranscriptFetchError("YouTube couldn't be searched just now", {
    failure: TranscriptFetchFailure.SOURCE_UNAVAILABLE,
    sourceId: "podcast-youtube",
    cause: error,
  });
};

// The podcast rungs, each asked only if the one before couldn't answer. What is kept for everyone
// is where the words were found, never the words: a show's transcript is its own work, so each
// reader fetches it from its source for themselves, and the search isn't repeated
// (docs/features/podcast-transcripts.md, "Each reader's own copy"; OV-297). The episode is read
// again from its own feed, never taken from the caller, and a video a caller names is checked
// against it by our server, so nothing a caller sends decides where an episode's words are.
export function createPodcastTranscripts({ fetchPublicWeb, sources, youTubeService, youTubeEpisodes, clock }: PodcastTranscriptsOptions) {
  const isFresh = (known: KnownWordSource) => known.source.via === "tag" || clock().getTime() - known.foundAt.getTime() < MATCH_KEPT_MS;

  const captionsOf = async (key: SourceKey, videoId: string, caller: ServiceCaller, log: FastifyBaseLogger) => {
    if (youTubeService === null) throw noCaptions("Our server doesn't fetch from YouTube", "podcast-youtube");
    const captions = await youTubeService.resolve(VideoId.parse(videoId), caller, log);
    const transcript: StoredTranscript = {
      videoId: key,
      segments: captions.transcript.segments,
      generated: captions.transcript.generated,
      fetchedAt: clock().toISOString(),
    };
    if (transcriptFault(transcript, key) !== null) throw noCaptions("The video's captions couldn't be read", "podcast-youtube");
    return transcript;
  };

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
      if (transcriptFault(transcript, key) === null) return { transcript, format, link };
    }
    return null;
  };

  const fromYouTube = async (key: SourceKey, episode: EpisodeToFind, ask: Exclude<YouTubeAsk, null>, request: PodcastTranscriptRequest) => {
    if (youTubeService === null || youTubeEpisodes === null) throw noCaptions("Our server doesn't fetch from YouTube", "podcast-youtube");
    let found: { videoId: string; matchedBy: "title" | "description"; searchedBy: "extension" | "server" };
    if ("videoId" in ask) {
      const matchedBy = await youTubeEpisodes.confirm(episode, ask.videoId).catch(dataApiUnavailable);
      if (matchedBy === null) throw new MatchUnconfirmedError();
      found = { videoId: ask.videoId, matchedBy, searchedBy: "extension" };
    } else {
      const search = await youTubeEpisodes.find(episode).catch(dataApiUnavailable);
      request.log.info(
        apiLogLines.podcasts.youTubeSearched({ units: search.units, searches: search.searches, found: search.found !== null }),
      );
      if (search.found === null) throw noCaptions("The episode isn't on its show's YouTube channel", "podcast-youtube");
      found = { videoId: search.found.videoId, matchedBy: search.found.via, searchedBy: "server" };
    }
    return {
      transcript: await captionsOf(key, found.videoId, request.caller, request.log),
      videoId: found.videoId,
      answer: { via: "youtube" as const, matchedBy: found.matchedBy, searchedBy: found.searchedBy },
    };
  };

  // A match kept past its 30 days, checked again against the episode for one quota unit, and kept
  // another 30 if it still is the episode.
  const refreshed = async (key: SourceKey, episode: EpisodeToFind, videoId: string, request: PodcastTranscriptRequest) => {
    if (youTubeEpisodes === null || (await youTubeEpisodes.confirm(episode, videoId).catch(() => null)) === null) return null;
    const transcript = await captionsOf(key, videoId, request.caller, request.log).catch(() => null);
    if (transcript !== null) await sources.put(key, { via: "youtube", videoId }, clock());
    return transcript;
  };

  // The words, fetched afresh from where they were found before; null where that no longer answers.
  const fromSource = async (
    key: SourceKey,
    source: EpisodeWordSource,
    caller: ServiceCaller,
    log: FastifyBaseLogger,
  ): Promise<StoredTranscript | null> => {
    if (source.via === "tag") return (await fromTag(key, [{ url: source.url, type: source.type, language: null }]))?.transcript ?? null;
    return captionsOf(key, source.videoId, caller, log).catch(() => null);
  };

  // An episode's words by its key alone, for a reader's other device, which knows the key but
  // not the feed: only where they were found before, and a match only within its 30 days, since
  // checking it again needs the feed (docs/features/podcast-transcripts.md).
  const remembered = async (key: SourceKey, caller: ServiceCaller, log: FastifyBaseLogger): Promise<StoredTranscript | null> => {
    const known = await sources.get(key);
    return known === null || !isFresh(known) ? null : fromSource(key, known.source, caller, log);
  };

  const resolve = async (request: PodcastTranscriptRequest): Promise<{ transcript: StoredTranscript; answer: PodcastTranscriptAnswer }> => {
    const key = await podcastSourceKey(request);
    const known = await sources.get(key);
    if (known !== null && isFresh(known)) {
      const words = await fromSource(key, known.source, request.caller, request.log);
      if (words !== null) return { transcript: words, answer: { via: "remembered", from: known.source.via } };
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
    if (item.title === null || show.title === null) throw noCaptions("The episode's feed offers no transcript we can read", "podcast-tag");
    const episode: EpisodeToFind = {
      showName: show.title,
      title: item.title,
      durationSeconds: item.durationSeconds,
      publishedAt: item.publishedAt,
      keywords: episodeKeywords(item.notes, neighbourNotes),
    };
    if (toRefresh !== null) {
      const words = await refreshed(key, episode, toRefresh, request);
      if (words !== null) return { transcript: words, answer: { via: "remembered", from: "youtube" } };
      await sources.forget(key);
    }
    if (request.youTube === null) throw noCaptions("The episode's feed offers no transcript we can read", "podcast-tag");
    const answered = await fromYouTube(key, episode, request.youTube, request);
    await sources.put(key, { via: "youtube", videoId: answered.videoId }, clock());
    return { transcript: answered.transcript, answer: answered.answer };
  };

  return { resolve, remembered };
}
