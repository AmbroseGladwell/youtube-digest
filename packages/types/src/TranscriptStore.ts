import type { VideoId } from "./Brands.js";
import type { StoredTranscript } from "./StoredTranscript.js";

// Keyed by video, not by overview: a transcript outlives the note taken from it, and is
// the same text for every reader of that video (docs/features/transcript-storage.md).
export interface TranscriptStore {
  getTranscript(videoId: VideoId): Promise<StoredTranscript | null>;
  saveTranscript(transcript: StoredTranscript): Promise<void>;
  deleteTranscript(videoId: VideoId): Promise<void>;
}
