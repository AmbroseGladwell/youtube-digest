import type { Handshake, RecordChangesPage, StoredTranscript, WrittenRecord } from "@overview/domain";

// One method per route, so the outbox maps onto it with no translation layer.
export interface SyncApi {
  handshake(): Promise<Handshake>;
  changes(since: number, limit?: number): Promise<RecordChangesPage>;
  createOverview(record: Record<string, unknown>, ifMatch: number | null): Promise<WrittenRecord>;
  reserveOverview(overviewId: string): Promise<void>;
  setOverviewTopics(id: string, topicIds: string[], updatedAt: string): Promise<WrittenRecord>;
  setOverviewCaptureReason(id: string, captureReason: string | null, updatedAt: string): Promise<WrittenRecord>;
  setOverviewTags(id: string, tags: string[], updatedAt: string): Promise<WrittenRecord>;
  setOverviewState(id: string, patch: Record<string, unknown>, updatedAt: string): Promise<WrittenRecord>;
  deleteOverview(id: string): Promise<WrittenRecord | null>;
  createTopic(record: Record<string, unknown>): Promise<WrittenRecord>;
  updateSettings(patch: Record<string, unknown>, updatedAt: string): Promise<WrittenRecord>;
  saveFollowedPlaylist(record: Record<string, unknown>, ifMatch: number | null): Promise<WrittenRecord>;
  deleteFollowedPlaylist(id: string): Promise<WrittenRecord | null>;
  createProject(record: Record<string, unknown>): Promise<WrittenRecord>;
  updateProject(id: string, patch: Record<string, unknown>, updatedAt: string): Promise<WrittenRecord>;
  deleteProject(id: string): Promise<WrittenRecord | null>;
  changeProjectMember(projectId: string, overviewId: string, change: Record<string, unknown>, updatedAt: string): Promise<WrittenRecord>;
  deleteChat(id: string): Promise<WrittenRecord | null>;
  saveTranscript(transcript: StoredTranscript): Promise<void>;
  getTranscript(videoId: string): Promise<StoredTranscript | null>;
}
