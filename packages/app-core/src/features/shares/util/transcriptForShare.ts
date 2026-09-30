import type { Overview, StoredTranscript, TranscriptStore } from "@overview/domain";

// Only what this device already holds. Fetching a transcript in order to share it would
// make sharing slow and could fail on a video whose captions have since gone; a copy
// without one is a page with two tabs rather than three (docs/features/sharing.md).
export async function transcriptForShare(
  transcriptStore: TranscriptStore,
  overview: Overview,
): Promise<StoredTranscript | null> {
  const videoId = overview.video.id;
  return videoId === null ? null : transcriptStore.getTranscript(videoId);
}
