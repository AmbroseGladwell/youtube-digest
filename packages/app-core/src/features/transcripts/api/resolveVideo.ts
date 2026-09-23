import { TranscriptFetchError, isWorthAnotherSource } from "@overview/transcripts";
import { VideoId, type StoredTranscript, type TranscriptStore } from "@overview/domain";
import { extractYouTubeVideoId } from "../../newOverview/util/parseYouTubeUrl.js";
import type { ResolvedVideo, TranscriptSource, TranscriptSourceContext } from "../types/TranscriptSource.js";
import { transcriptFailureMessage } from "../util/transcriptFailureMessage.js";
import { NoTranscriptSourceError, type TranscriptSourceFailure } from "./NoTranscriptSourceError.js";

export interface VideoResolutionDeps {
  sources: TranscriptSource[];
  transcriptStore: TranscriptStore;
}

export type { ResolvedVideo };

// The rungs in order, each asked only if the one before could not answer. The store is
// read before any of them (docs/features/transcript-retrieval.md).
export async function resolveVideo(
  url: string,
  deps: VideoResolutionDeps,
): Promise<ResolvedVideo> {
  const cached = await readCachedVideo(url, deps.transcriptStore);
  if (cached) return cached;

  const context: TranscriptSourceContext = {
    readHeldTranscript: (videoId) => deps.transcriptStore.getTranscript(videoId),
  };
  const failures: TranscriptSourceFailure[] = [];

  for (const source of deps.sources) {
    if (!(await source.isReady())) {
      failures.push({ tier: source.tier, outcome: "unavailable" });
      continue;
    }

    try {
      const resolved = await source.resolve(url, context);
      if (resolved === null) {
        failures.push({ tier: source.tier, outcome: "no-answer" });
        continue;
      }
      await saveResolved(resolved, deps.transcriptStore);
      return resolved;
    } catch (error) {
      failures.push({ tier: source.tier, outcome: "failed", error });
      // Nothing about the video will be different at the next rung.
      if (error instanceof TranscriptFetchError && !isWorthAnotherSource(error.failure)) {
        throw error;
      }
    }
  }

  throw new NoTranscriptSourceError(transcriptFailureMessage(failures), failures);
}

// The one place a resolved video is written back, so every rung completes a record that
// was stored before metadata was kept (docs/features/watching-detection.md).
async function saveResolved(resolved: ResolvedVideo, transcriptStore: TranscriptStore): Promise<void> {
  if (resolved.video.id === null) return;
  await transcriptStore.saveTranscript({
    videoId: resolved.video.id,
    segments: resolved.transcript,
    generated: resolved.generated,
    fetchedAt: new Date().toISOString(),
    video: resolved.video,
  });
}

// The url is this request's, not the one the first fetch happened to use: everything else
// describes the video, but the url is what the reader's timestamp links point at.
async function readCachedVideo(
  url: string,
  transcriptStore: TranscriptStore,
): Promise<ResolvedVideo | null> {
  const parsedId = parseVideoId(url);
  if (parsedId === null) return null;

  const stored: StoredTranscript | null = await transcriptStore.getTranscript(parsedId);
  if (!stored?.video) return null;

  return { video: { ...stored.video, url }, transcript: stored.segments, generated: stored.generated };
}

// Only ever used to ask the store a question. A parse that disagreed with the platform's
// own id costs one metadata call and then resolves by the real id; it can never file
// captions under an invented one.
function parseVideoId(url: string): VideoId | null {
  const id = extractYouTubeVideoId(url);
  return id === null ? null : VideoId.parse(id);
}
