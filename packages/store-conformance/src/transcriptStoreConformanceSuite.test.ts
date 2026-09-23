import type { StoredTranscript, TranscriptStore, VideoId } from "@overview/domain";
import { defineTranscriptStoreConformanceSuite } from "./transcriptStoreConformanceSuite.js";

class InMemoryTranscriptStore implements TranscriptStore {
  #transcripts = new Map<VideoId, StoredTranscript>();

  async getTranscript(videoId: VideoId) {
    return this.#transcripts.get(videoId) ?? null;
  }

  async saveTranscript(transcript: StoredTranscript) {
    this.#transcripts.set(transcript.videoId, transcript);
  }

  async deleteTranscript(videoId: VideoId) {
    this.#transcripts.delete(videoId);
  }
}

defineTranscriptStoreConformanceSuite("InMemoryTranscriptStore (reference)", () => new InMemoryTranscriptStore());
