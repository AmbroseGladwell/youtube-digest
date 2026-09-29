import type { Handshake, RecordChangesPage, StoredTranscript, WrittenRecord } from "@overview/domain";

// The server's write surface, one method per route, so the outbox maps onto it without a
// translation layer (docs/features/sync-api.md, docs/features/sync-client.md).
export interface SyncApi {
  handshake(): Promise<Handshake>;
  changes(since: number, limit?: number): Promise<RecordChangesPage>;
  createOverview(record: Record<string, unknown>, ifMatch: number | null): Promise<WrittenRecord>;
  setOverviewTopics(id: string, topicIds: string[], updatedAt: string): Promise<WrittenRecord>;
  setOverviewCaptureReason(id: string, captureReason: string | null, updatedAt: string): Promise<WrittenRecord>;
  setOverviewState(id: string, patch: Record<string, unknown>, updatedAt: string): Promise<WrittenRecord>;
  deleteOverview(id: string): Promise<WrittenRecord | null>;
  createTopic(record: Record<string, unknown>): Promise<WrittenRecord>;
  updateSettings(patch: Record<string, unknown>, updatedAt: string): Promise<WrittenRecord>;
  saveTranscript(transcript: StoredTranscript): Promise<void>;
  // Null when the account keeps no transcript for the video.
  getTranscript(videoId: string): Promise<StoredTranscript | null>;
}
