import type { Overview } from "./Overview.js";
import type { Topic } from "./Topic.js";
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

export interface OverviewStore {
  // Null means no such record. A record that is present and cannot be read throws an
  // UnreadableRecordError instead, because those are different things
  // (docs/features/record-migrations.md).
  getOverview(id: OverviewId): Promise<Overview | null>;
  listOverviews(query?: OverviewQuery): Promise<Overview[]>;
  // What listOverviews left out, so that nothing the store holds can go missing without
  // being counted (docs/features/record-migrations.md).
  listUnreadable(): Promise<UnreadableRecord[]>;
  saveOverview(overview: Overview): Promise<void>;
  // The app's whole read-modify-write surface, named rather than expressed as a whole
  // record: parsing on read is what makes saving a spread of a parsed overview lossy
  // (docs/features/record-migrations.md).
  setOverviewTopics(overviewId: OverviewId, topicIds: TopicId[]): Promise<void>;
  setOverviewCaptureReason(overviewId: OverviewId, captureReason: string | null): Promise<void>;
  deleteOverview(id: OverviewId): Promise<void>;

  listClaims(): Promise<ClaimSummary[]>;

  listTopics(): Promise<Topic[]>;
  createTopic(input: { name: string; description?: string }): Promise<Topic>;

  getOverviewState(overviewId: OverviewId): Promise<OverviewState>;
  setOverviewState(
    overviewId: OverviewId,
    patch: Partial<Pick<OverviewState, "read" | "favourite" | "userTags">>,
  ): Promise<void>;
}
