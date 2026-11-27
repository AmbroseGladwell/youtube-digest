import type { Overview } from "./Overview.js";
import type { Topic } from "./Topic.js";
import type { TopicMerge } from "./TopicMerge.js";
import type { OverviewState } from "./OverviewState.js";
import type { OverviewId, TopicId } from "./Brands.js";
import type { UnreadableRecord } from "./UnreadableRecord.js";

export interface OverviewQuery {
  topicId?: TopicId;
  unsorted?: boolean;
}

export interface ClaimSummary {
  overviewId: OverviewId;
  title: string;
  claim: string;
}

export interface CreateTopicOptions {
  name: string;
  description?: string;
}

export interface OverviewStore {
  // Null is no record; an unreadable one throws (docs/features/record-migrations.md).
  getOverview(id: OverviewId): Promise<Overview | null>;
  listOverviews(query?: OverviewQuery): Promise<Overview[]>;
  // So nothing the store holds goes missing uncounted (docs/features/record-migrations.md).
  listUnreadable(): Promise<UnreadableRecord[]>;
  saveOverview(overview: Overview): Promise<void>;
  // Named writes, since saving a spread of a parsed overview is lossy (docs/features/record-migrations.md).
  setOverviewTopics(overviewId: OverviewId, topicIds: TopicId[]): Promise<void>;
  setOverviewCaptureReason(overviewId: OverviewId, captureReason: string | null): Promise<void>;
  // A merge, rename or delete rewrites the note's tags in place (docs/features/tag-reuse.md).
  setOverviewTags(overviewId: OverviewId, tags: string[]): Promise<void>;
  deleteOverview(id: OverviewId): Promise<void>;

  listClaims(): Promise<ClaimSummary[]>;

  listTopics(): Promise<Topic[]>;
  createTopic(input: CreateTopicOptions): Promise<Topic>;
  // Re-filed here unjournalled, since the server re-files too: docs/features/topic-filing.md, "On the device".
  renameTopic(id: TopicId, name: string): Promise<void>;
  mergeTopic(from: TopicId, into: TopicId): Promise<TopicMerge | null>;
  restoreTopic(merge: TopicMerge): Promise<void>;
  deleteTopic(id: TopicId): Promise<void>;

  getOverviewState(overviewId: OverviewId): Promise<OverviewState>;
  // Only the states written: an overview nobody has touched has none, and getOverviewState gives its default.
  listOverviewStates(): Promise<OverviewState[]>;
  setOverviewState(overviewId: OverviewId, patch: Partial<Pick<OverviewState, "read" | "favourite" | "userTags" | "asked">>): Promise<void>;
}
