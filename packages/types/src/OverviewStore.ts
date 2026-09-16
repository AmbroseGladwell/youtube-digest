import type { Overview } from "./Overview.js";
import type { Topic } from "./Topic.js";
import type { OverviewState } from "./OverviewState.js";
import type { OverviewId, TopicId } from "./Brands.js";

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
  getOverview(id: OverviewId): Promise<Overview | null>;
  listOverviews(query?: OverviewQuery): Promise<Overview[]>;
  saveOverview(overview: Overview): Promise<void>;
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
