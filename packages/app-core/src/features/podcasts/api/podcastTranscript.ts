import { podcastSourceId, sourceKey, type PodcastEpisode, type StoredTranscript } from "@overview/domain";
import { isSyncRequestError, type PodcastApi } from "@overview/sync";
import {
  fetchInnerTubeTranscript,
  findEpisodeOnYouTube,
  TranscriptFetchError,
  TranscriptFetchFailure,
  type YouTubeFetch,
} from "@overview/transcripts";

export interface PodcastTranscript {
  transcript: StoredTranscript;
  // False when the captions came from a video our server couldn't confirm: the reader uses them,
  // and nothing was kept for anyone else.
  keptForEveryone: boolean;
}

const FAILURES = new Set<string>(Object.values(TranscriptFetchFailure));
const SOURCE_ID = "podcast";

const asTranscriptError = (error: unknown): TranscriptFetchError => {
  if (error instanceof TranscriptFetchError) return error;
  if (isSyncRequestError(error) && error.code === "transcript_unavailable") {
    const failure = error.details?.failure;
    return new TranscriptFetchError(error.message, {
      failure:
        typeof failure === "string" && FAILURES.has(failure)
          ? (failure as TranscriptFetchFailure)
          : TranscriptFetchFailure.SOURCE_UNAVAILABLE,
      sourceId: SOURCE_ID,
      cause: error,
    });
  }
  if (isSyncRequestError(error) && error.code === "too_many_requests") {
    const said = error.details?.retryAfterSeconds;
    return new TranscriptFetchError(error.message, {
      failure: error.details?.daily === true ? TranscriptFetchFailure.DAILY_CAP : TranscriptFetchFailure.RATE_LIMITED,
      sourceId: SOURCE_ID,
      cause: error,
      ...(typeof said === "number" ? { retryAfterSeconds: said } : {}),
    });
  }
  return new TranscriptFetchError("Our server couldn't be asked for the transcript", {
    failure: TranscriptFetchFailure.SOURCE_UNAVAILABLE,
    sourceId: SOURCE_ID,
    cause: error,
  });
};

const isNoCaptions = (error: unknown) => isSyncRequestError(error) && error.details?.failure === TranscriptFetchFailure.NO_CAPTIONS;
const isUnconfirmed = (error: unknown) => isSyncRequestError(error) && error.details?.match === "unconfirmed";

// An episode's transcript, free routes first: our server's cache and the feed's own transcript,
// then the episode on its show's YouTube channel, found by the reader's extension on their own
// connection and checked by our server before it is kept for everyone. Without an extension, our
// server searches itself (docs/features/podcast-on-youtube.md, "The reader's part").
export async function podcastTranscript(
  api: Pick<PodcastApi, "transcript">,
  episode: PodcastEpisode,
  youTubeFetch: YouTubeFetch | null,
): Promise<PodcastTranscript> {
  const ask = { feedUrl: episode.feedUrl, guid: episode.guid };
  try {
    return { transcript: await api.transcript(ask), keptForEveryone: true };
  } catch (error) {
    if (!isNoCaptions(error)) throw asTranscriptError(error);
  }

  let videoId: string | null = null;
  if (youTubeFetch !== null) {
    try {
      const found = await findEpisodeOnYouTube(youTubeFetch, {
        showName: episode.showName,
        title: episode.title,
        durationSeconds: episode.durationSeconds,
        publishedAt: episode.publishedAt,
        keywords: episode.notesKeywords,
      });
      if (found === null) {
        throw new TranscriptFetchError("This episode isn't on its show's YouTube channel", {
          failure: TranscriptFetchFailure.NO_CAPTIONS,
          sourceId: SOURCE_ID,
        });
      }
      videoId = found.videoId;
    } catch (error) {
      if (error instanceof TranscriptFetchError && error.failure === TranscriptFetchFailure.NO_CAPTIONS) throw error;
    }
  }

  if (videoId === null) {
    return api.transcript({ ...ask, searchYouTube: true }).then(
      (transcript) => ({ transcript, keptForEveryone: true }),
      (error: unknown) => Promise.reject(asTranscriptError(error)),
    );
  }
  try {
    return { transcript: await api.transcript({ ...ask, youTubeVideoId: videoId }), keptForEveryone: true };
  } catch (error) {
    if (!isUnconfirmed(error) || youTubeFetch === null) throw asTranscriptError(error);
  }
  const fetched = await fetchInnerTubeTranscript(youTubeFetch, videoId, `https://www.youtube.com/watch?v=${videoId}`);
  return {
    transcript: {
      videoId: sourceKey({ kind: "podcast", id: await podcastSourceId(episode) })!,
      segments: fetched.transcript,
      generated: fetched.generated,
      fetchedAt: new Date().toISOString(),
    },
    keptForEveryone: false,
  };
}
