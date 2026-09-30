import type { StoredTranscript, VideoId } from "@overview/domain";

export type TranscriptFault = "no-segments" | "no-words" | "times-out-of-order" | "another-video";

// What makes a transcript unfit to share, checked before anything is kept
// (docs/features/shared-transcript-cache.md, "What a contribution has to be").
export function transcriptFault(transcript: StoredTranscript, videoId: VideoId): TranscriptFault | null {
  const { segments } = transcript;
  if (transcript.videoId !== videoId || (transcript.video?.id != null && transcript.video.id !== videoId)) {
    return "another-video";
  }
  if (segments.length === 0) return "no-segments";
  if (segments.every((segment) => segment.text.trim() === "")) return "no-words";
  const outOfOrder = segments.some(
    (segment, index) => segment.endMs < segment.startMs || (index > 0 && segment.startMs < segments[index - 1]!.startMs),
  );
  return outOfOrder ? "times-out-of-order" : null;
}
