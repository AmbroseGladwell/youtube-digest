import type { Handshake, RecordChangesPage, StoredTranscript, WrittenRecord } from "@overview/domain";

// One method per route, so the outbox maps onto it with no translation layer.
export interface SyncApi {
  handshake(): Promise<Handshake>;
  changes(since: number, limit?: number): Promise<RecordChangesPage>;
  createOverview(record: Record<string, unknown>, ifMatch: number | null): Promise<WrittenRecord>;
  reserveOverview(overviewId: string): Promise<void>;
  // Edited is the reader's own change, which moves Updated; a fold of duplicates isn't.
  setOverviewTopics(id: string, topicIds: string[], updatedAt: string, edited?: boolean): Promise<WrittenRecord>;
  setOverviewCaptureReason(id: string, captureReason: string | null, updatedAt: string, edited?: boolean): Promise<WrittenRecord>;
  setOverviewTags(id: string, tags: string[], updatedAt: string, edited?: boolean): Promise<WrittenRecord>;
  setOverviewState(id: string, patch: Record<string, unknown>, updatedAt: string): Promise<WrittenRecord>;
  deleteOverview(id: string): Promise<WrittenRecord | null>;
  createTopic(record: Record<string, unknown>): Promise<WrittenRecord>;
  updateTopic(id: string, patch: Record<string, unknown>, updatedAt: string): Promise<WrittenRecord>;
  mergeTopic(id: string, into: string, updatedAt: string): Promise<void>;
  restoreTopic(id: string, restore: Record<string, unknown>, updatedAt: string): Promise<void>;
  deleteTopic(id: string): Promise<WrittenRecord | null>;
  updateSettings(patch: Record<string, unknown>, updatedAt: string): Promise<WrittenRecord>;
  saveFollowedPlaylist(record: Record<string, unknown>, ifMatch: number | null): Promise<WrittenRecord>;
  deleteFollowedPlaylist(id: string): Promise<WrittenRecord | null>;
  saveCapture(record: Record<string, unknown>, ifMatch: number | null): Promise<WrittenRecord>;
  deleteCapture(id: string): Promise<WrittenRecord | null>;
  createProject(record: Record<string, unknown>): Promise<WrittenRecord>;
  updateProject(id: string, patch: Record<string, unknown>, updatedAt: string): Promise<WrittenRecord>;
  deleteProject(id: string): Promise<WrittenRecord | null>;
  changeProjectMember(projectId: string, overviewId: string, change: Record<string, unknown>, updatedAt: string): Promise<WrittenRecord>;
  deleteChat(id: string): Promise<WrittenRecord | null>;
  changeSuggestedQuestion(id: string, change: Record<string, unknown>, updatedAt: string): Promise<WrittenRecord>;
  saveTranscript(transcript: StoredTranscript): Promise<void>;
  getTranscript(videoId: string): Promise<StoredTranscript | null>;
}
