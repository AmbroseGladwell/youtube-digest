import { podcastSourceId, sourceKey, StoredTranscript, type PodcastTranscriptLink, type SourceKey } from "@overview/domain";
import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import { readBodyText, type createPublicWebFetch } from "../publicWeb/createPublicWebFetch.js";
import { transcriptFault } from "../transcripts/transcriptFault.js";
import type { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";
import { feedItemGuid, fetchFeedEpisode } from "./fetchFeedEpisode.js";
import {
  FORMAT_PREFERENCE,
  parsePodcastTranscript,
  podcastTranscriptFormat,
  type PodcastTranscriptFormat,
} from "./parsePodcastTranscript.js";

export type PodcastTranscriptAnswer = { via: "cache" } | { via: "tag"; format: PodcastTranscriptFormat };

export interface PodcastTranscriptsOptions {
  fetchPublicWeb: ReturnType<typeof createPublicWebFetch>;
  transcripts: Pick<TranscriptsRepository, "getShared" | "putServiceFetched">;
  clock: () => Date;
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

// The podcast rungs, each asked only if the one before couldn't answer, and every answer kept
// in the shared cache so an episode is fetched once, ever (docs/features/podcast-transcripts.md).
// The episode is read again from its own feed, never taken from the caller, so nothing a caller
// sends decides what is kept under an episode's key.
export function createPodcastTranscripts({ fetchPublicWeb, transcripts, clock }: PodcastTranscriptsOptions) {
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

  return async function resolvePodcastTranscript(episode: {
    feedUrl: string;
    guid: string;
  }): Promise<{ transcript: StoredTranscript; answer: PodcastTranscriptAnswer }> {
    const key = await podcastSourceKey(episode);
    const cached = StoredTranscript.safeParse(await transcripts.getShared(key));
    if (cached.success) return { transcript: cached.data, answer: { via: "cache" } };

    const read = await fetchFeedEpisode(fetchPublicWeb, episode.feedUrl, (item) => feedItemGuid(item) === episode.guid);
    if (read.status === "failed") {
      throw new TranscriptFetchError("The show's feed couldn't be read", {
        failure: TranscriptFetchFailure.SOURCE_UNAVAILABLE,
        sourceId: "podcast-feed",
      });
    }
    if (read.feed.item === null) {
      throw new TranscriptFetchError("The episode isn't in its show's feed", {
        failure: TranscriptFetchFailure.VIDEO_UNAVAILABLE,
        sourceId: "podcast-feed",
      });
    }
    const tagged = await fromTag(key, read.feed.item.transcripts);
    if (tagged === null) {
      throw new TranscriptFetchError("The episode's feed offers no transcript we can read", {
        failure: TranscriptFetchFailure.NO_CAPTIONS,
        sourceId: "podcast-tag",
      });
    }
    await transcripts.putServiceFetched(tagged.transcript);
    return { transcript: tagged.transcript, answer: { via: "tag", format: tagged.format } };
  };
}
