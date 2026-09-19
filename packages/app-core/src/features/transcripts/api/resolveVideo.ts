import { VideoId, type StoredTranscript, type TranscriptSegment, type TranscriptStore, type VideoSource } from "@overview/types";
import {
  fetchTranscriptContent,
  fetchVideoSource,
  type TranscriptSourceClient,
} from "@overview/transcripts";
import { extractYouTubeVideoId } from "../../newOverview/util/parseYouTubeUrl.js";

export interface VideoResolutionDeps {
  transcriptClient: TranscriptSourceClient;
  transcriptStore: TranscriptStore;
}

export interface ResolvedVideo {
  video: VideoSource;
  transcript: TranscriptSegment[];
}

// Both halves of what the provider sells for one video — the metadata and the captions —
// read before either is bought (docs/features/watching-detection.md).
export async function resolveVideo(
  url: string,
  deps: VideoResolutionDeps,
): Promise<ResolvedVideo> {
  const cached = await readCachedVideo(url, deps.transcriptStore);
  if (cached) return cached;

  const video = await fetchVideoSource(deps.transcriptClient, url);
  const stored = video.id === null ? null : await deps.transcriptStore.getTranscript(video.id);

  if (stored) {
    await deps.transcriptStore.saveTranscript({ ...stored, video });
    return { video, transcript: stored.segments };
  }

  const fetched = await fetchTranscriptContent(deps.transcriptClient, url);

  if (video.id !== null) {
    await deps.transcriptStore.saveTranscript({
      videoId: video.id,
      segments: fetched.transcript,
      generated: fetched.generated,
      fetchedAt: new Date().toISOString(),
      video,
    });
  }

  return { video, transcript: fetched.transcript };
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

  return { video: { ...stored.video, url }, transcript: stored.segments };
}

// Only ever used to ask the store a question. A parse that disagreed with the platform's
// own id costs one metadata call and then resolves by the real id; it can never file
// captions under an invented one.
function parseVideoId(url: string): VideoId | null {
  const id = extractYouTubeVideoId(url);
  return id === null ? null : VideoId.parse(id);
}
