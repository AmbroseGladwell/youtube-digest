import { VideoId } from "@overview/domain";
import { isSyncRequestError, type ServiceTranscriptApi } from "@overview/sync";
import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import { extractYouTubeVideoId } from "../../newOverview/util/parseYouTubeUrl.js";
import type { TranscriptSource } from "../types/TranscriptSource.js";
import { resumesAtFrom, serverBusyResumeSentence, serverCapResumeSentence } from "../util/resumeTime.js";

const BUSY_RETRY_SECONDS = 60;

const retryAfterOf = (details: Record<string, unknown> | undefined): number | null => {
  const said = details?.retryAfterSeconds;
  return typeof said === "number" && said > 0 ? Math.ceil(said) : null;
};

const SOURCE_ID = "service";
const STATUS_TIMEOUT_MS = 3000;
const FAILURES = new Set<string>(Object.values(TranscriptFetchFailure));

const serviceError = (message: string, failure: TranscriptFetchFailure, cause?: unknown, retryAfterSeconds?: number) =>
  new TranscriptFetchError(message, {
    failure,
    sourceId: SOURCE_ID,
    ...(cause === undefined ? {} : { cause }),
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  });

function asServiceError(error: unknown): TranscriptFetchError | null {
  if (!isSyncRequestError(error)) {
    return serviceError("Our server could not be reached to fetch the transcript.", TranscriptFetchFailure.SOURCE_UNAVAILABLE, error);
  }
  if (error.code === "unavailable") return null;
  if (error.code === "transcript_unavailable") {
    const failure = error.details?.failure;
    return serviceError(
      error.message,
      typeof failure === "string" && FAILURES.has(failure)
        ? (failure as TranscriptFetchFailure)
        : TranscriptFetchFailure.SOURCE_UNAVAILABLE,
      error,
    );
  }
  if (error.code === "too_many_requests") {
    const retryAfterSeconds = retryAfterOf(error.details);
    if (error.details?.daily === true) {
      return serviceError(
        serverCapResumeSentence(resumesAtFrom(retryAfterSeconds, new Date())),
        TranscriptFetchFailure.DAILY_CAP,
        error,
        retryAfterSeconds ?? undefined,
      );
    }
    const waitSeconds = retryAfterSeconds ?? BUSY_RETRY_SECONDS;
    return serviceError(
      serverBusyResumeSentence(resumesAtFrom(waitSeconds, new Date())),
      TranscriptFetchFailure.RATE_LIMITED,
      error,
      waitSeconds,
    );
  }
  return serviceError("Our server could not fetch the transcript.", TranscriptFetchFailure.SOURCE_UNAVAILABLE, error);
}

// The last rung: our own server fetches the captions, which costs us rather than the
// reader, so the background prefetch never reaches it and a server with it off is never
// offered (docs/architecture/server-side-transcripts.md).
export const serviceTranscriptSource = (api: ServiceTranscriptApi): TranscriptSource => ({
  tier: "service",
  cost: "metered",
  isReady: () =>
    Promise.race([
      api.status().then((status) => status.available, () => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), STATUS_TIMEOUT_MS)),
    ]),
  resolve: async (url) => {
    const videoId = extractYouTubeVideoId(url);
    if (videoId === null) return null;

    let fetched;
    try {
      fetched = await api.fetch(VideoId.parse(videoId));
    } catch (error) {
      const failed = asServiceError(error);
      if (failed === null) return null;
      throw failed;
    }
    if (!fetched.video) {
      throw serviceError("Our server answered without the video's details.", TranscriptFetchFailure.MALFORMED_RESPONSE);
    }
    return { video: { ...fetched.video, url }, transcript: fetched.segments, generated: fetched.generated };
  },
});
