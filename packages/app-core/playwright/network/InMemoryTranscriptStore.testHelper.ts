import type { StoredTranscript, TranscriptStore, VideoId } from "@overview/domain";

export class InMemoryTranscriptStore implements TranscriptStore {
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

  // Test-only seeding helper — not part of the TranscriptStore interface.
  seedTranscript(transcript: StoredTranscript): void {
    this.#transcripts.set(transcript.videoId, transcript);
  }
}
