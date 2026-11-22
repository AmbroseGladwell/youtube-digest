import type { VideoId } from "./Brands.js";
import type { StoredTranscript } from "./StoredTranscript.js";

// Keyed by video: a transcript outlives its note (docs/features/transcript-storage.md).
export interface TranscriptStore {
  getTranscript(videoId: VideoId): Promise<StoredTranscript | null>;
  saveTranscript(transcript: StoredTranscript): Promise<void>;
  deleteTranscript(videoId: VideoId): Promise<void>;
}
