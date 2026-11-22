import { TranscriptFetchError, isWorthAnotherSource } from "@overview/transcripts";
import {
  VideoId,
  type CaptureStepOutcome,
  type CaptureTranscriptSource,
  type ClientWarningReport,
  type StoredTranscript,
  type TranscriptStore,
} from "@overview/domain";
import type { CaptureStopwatch } from "../../newOverview/api/CaptureStopwatch.js";
import { canonicalYouTubeUrl, extractYouTubeVideoId } from "../../newOverview/util/parseYouTubeUrl.js";
import type { ResolvedVideo, TranscriptSource, TranscriptSourceContext } from "../types/TranscriptSource.js";
import { transcriptFailureMessage } from "../util/transcriptFailureMessage.js";
import { NoTranscriptSourceError, type TranscriptSourceFailure } from "./NoTranscriptSourceError.js";

export interface VideoResolutionDeps {
  sources: TranscriptSource[];
  transcriptStore: TranscriptStore;
  // When the ladder warns: docs/architecture/errors-and-logs.md, "Client warnings".
  warn?: ((warning: ClientWarningReport) => void) | undefined;
  stopwatch?: CaptureStopwatch | undefined;
}

const warnIfDegraded = (
  deps: VideoResolutionDeps,
  failures: TranscriptSourceFailure[],
  answeredBy: TranscriptSourceFailure["tier"] | null,
) => {
  if (answeredBy !== null && !failures.some(({ outcome }) => outcome === "failed")) {
    return;
  }
  if (failures.length === 0) {
    return;
  }
  deps.warn?.({
    name: "transcriptFellThrough",
    passed: failures.map(({ tier, outcome, error }) => ({
      rung: tier,
      outcome,
      ...(error instanceof TranscriptFetchError ? { failure: error.failure } : {}),
    })),
    answeredBy,
  });
};

export type { ResolvedVideo };

const UNAVAILABLE = Symbol("unavailable");
const answeredOrNot = (answer: unknown): CaptureStepOutcome => (answer === null ? "no-answer" : "answered");
const rungOutcomeOf = (answer: ResolvedVideo | null | typeof UNAVAILABLE): CaptureStepOutcome =>
  answer === UNAVAILABLE ? "unavailable" : answeredOrNot(answer);

export interface ResolvedVideoWithSource extends ResolvedVideo {
  source: CaptureTranscriptSource;
}

// The rungs, in order: docs/features/transcript-retrieval.md, "The ladder".
export const resolveVideo = async (pastedUrl: string, deps: VideoResolutionDeps): Promise<ResolvedVideoWithSource> => {
  const url = canonicalYouTubeUrl(pastedUrl) ?? pastedUrl;
  const { stopwatch } = deps;
  const cached = await (stopwatch
    ? stopwatch.time("stored", () => readCachedVideo(url, deps.transcriptStore), answeredOrNot)
    : readCachedVideo(url, deps.transcriptStore));
  if (cached) {
    return { ...cached, source: "stored" };
  }

  const context: TranscriptSourceContext = {
    readHeldTranscript: (videoId) => deps.transcriptStore.getTranscript(videoId),
  };
  const failures: TranscriptSourceFailure[] = [];

  for (const source of deps.sources) {
    const ask = async () => ((await source.isReady()) ? source.resolve(url, context) : UNAVAILABLE);
    try {
      const resolved = await (stopwatch ? stopwatch.time(source.tier, ask, rungOutcomeOf) : ask());
      if (resolved === UNAVAILABLE) {
        failures.push({ tier: source.tier, outcome: "unavailable" });
        continue;
      }
      if (resolved === null) {
        failures.push({ tier: source.tier, outcome: "no-answer" });
        continue;
      }
      await saveResolved(resolved, deps.transcriptStore);
      warnIfDegraded(deps, failures, source.tier);
      return { ...resolved, source: source.tier };
    } catch (error) {
      failures.push({ tier: source.tier, outcome: "failed", error });
      if (error instanceof TranscriptFetchError && !isWorthAnotherSource(error.failure)) {
        throw error;
      }
    }
  }

  warnIfDegraded(deps, failures, null);
  throw new NoTranscriptSourceError(transcriptFailureMessage(failures), failures);
};

// The only write-back: docs/features/transcript-retrieval.md, "Why the rung is one method".
const saveResolved = async (resolved: ResolvedVideo, transcriptStore: TranscriptStore): Promise<void> => {
  if (resolved.video.id === null) {
    return;
  }
  await transcriptStore.saveTranscript({
    videoId: resolved.video.id,
    segments: resolved.transcript,
    generated: resolved.generated,
    fetchedAt: new Date().toISOString(),
    video: resolved.video,
  });
};

// The url is this request's, not the stored one: it is what the reader's timestamp links point at.
const readCachedVideo = async (url: string, transcriptStore: TranscriptStore): Promise<ResolvedVideo | null> => {
  const parsedId = parseVideoId(url);
  if (parsedId === null) {
    return null;
  }

  const stored: StoredTranscript | null = await transcriptStore.getTranscript(parsedId);
  if (!stored?.video) {
    return null;
  }

  return { video: { ...stored.video, url }, transcript: stored.segments, generated: stored.generated };
};

// Only asks the store: a wrong parse costs a metadata call, never captions filed under a wrong id.
const parseVideoId = (url: string): VideoId | null => {
  const id = extractYouTubeVideoId(url);
  return id === null ? null : VideoId.parse(id);
};
