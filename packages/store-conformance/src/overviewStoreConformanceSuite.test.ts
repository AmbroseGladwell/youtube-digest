import { randomUUID } from "node:crypto";
import {
  DEFAULT_OVERVIEW_STATE,
  TopicId,
  type ClaimSummary,
  type Overview,
  type OverviewId,
  type OverviewQuery,
  type OverviewState,
  type OverviewStore,
  type Topic,
  type UnreadableRecord,
} from "@overview/domain";
import { defineOverviewStoreConformanceSuite } from "./overviewStoreConformanceSuite.js";

class InMemoryOverviewStore implements OverviewStore {
  #overviews = new Map<OverviewId, Overview>();
  #topics = new Map<TopicId, Topic>();
  #states = new Map<OverviewId, OverviewState>();

  async getOverview(id: OverviewId) {
    return this.#overviews.get(id) ?? null;
  }

  async listOverviews(query: OverviewQuery = {}) {
    return [...this.#overviews.values()].filter((overview) => {
      if (query.unsorted) return overview.topicIds.length === 0;
      if (query.topicId) return overview.topicIds.includes(query.topicId);
      return true;
    });
  }

  async listUnreadable(): Promise<UnreadableRecord[]> {
    return [];
  }

  async saveOverview(overview: Overview) {
    this.#overviews.set(overview.id, overview);
  }

  async setOverviewTopics(overviewId: OverviewId, topicIds: TopicId[]) {
    const overview = this.#overviews.get(overviewId);
    if (overview) {
      this.#overviews.set(overviewId, { ...overview, topicIds });
    }
  }

  async setOverviewCaptureReason(overviewId: OverviewId, captureReason: string | null) {
    const overview = this.#overviews.get(overviewId);
    if (overview) {
      this.#overviews.set(overviewId, { ...overview, captureReason });
    }
  }

  async deleteOverview(id: OverviewId) {
    this.#overviews.delete(id);
  }

  async listClaims(): Promise<ClaimSummary[]> {
    return [...this.#overviews.values()].map((overview) => ({
      overviewId: overview.id,
      title: overview.video.title,
      claim: overview.coreClaim,
    }));
  }

  async listTopics() {
    return [...this.#topics.values()];
  }

  async createTopic(input: { name: string; description?: string }) {
    const topic: Topic = {
      id: TopicId.parse(randomUUID()),
      name: input.name,
      description: input.description ?? null,
      createdAt: new Date().toISOString(),
    };
    this.#topics.set(topic.id, topic);
    return topic;
  }

  async getOverviewState(overviewId: OverviewId) {
    return this.#states.get(overviewId) ?? { overviewId, ...DEFAULT_OVERVIEW_STATE };
  }

  async setOverviewState(
    overviewId: OverviewId,
    patch: Partial<Pick<OverviewState, "read" | "favourite" | "userTags">>,
  ) {
    const current = await this.getOverviewState(overviewId);
    this.#states.set(overviewId, { ...current, ...patch });
  }
}

defineOverviewStoreConformanceSuite("InMemoryOverviewStore (reference)", () => ({
  store: new InMemoryOverviewStore(),
}));
