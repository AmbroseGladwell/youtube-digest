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
  type Refiling,
  type TopicMerge,
  addedOnMerge,
  refiledOnMerge,
  refiledOnRestore,
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
      if (query.unsorted) {
        return overview.topicIds.length === 0;
      }
      if (query.topicId) {
        return overview.topicIds.includes(query.topicId);
      }
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
      this.#overviews.set(overviewId, { ...overview, topicIds, editedAt: new Date().toISOString() });
    }
  }

  async setOverviewCaptureReason(overviewId: OverviewId, captureReason: string | null) {
    const overview = this.#overviews.get(overviewId);
    if (overview) {
      this.#overviews.set(overviewId, { ...overview, captureReason, editedAt: new Date().toISOString() });
    }
  }

  async setOverviewTags(overviewId: OverviewId, tags: string[]) {
    const overview = this.#overviews.get(overviewId);
    if (overview) {
      this.#overviews.set(overviewId, { ...overview, tags, editedAt: new Date().toISOString() });
    }
  }

  async deleteOverview(id: OverviewId) {
    this.#overviews.delete(id);
    this.#states.delete(id);
  }

  async listClaims(): Promise<ClaimSummary[]> {
    return [...this.#overviews.values()].map((overview) => ({
      overviewId: overview.id,
      title: overview.source.title,
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

  async renameTopic(id: TopicId, name: string) {
    const topic = this.#topics.get(id);
    if (topic) {
      this.#topics.set(id, { ...topic, name });
    }
  }

  async mergeTopic(from: TopicId, into: TopicId): Promise<TopicMerge | null> {
    const topic = this.#topics.get(from);
    if (topic === undefined || from === into || !this.#topics.has(into)) {
      return null;
    }
    const filed = [...this.#overviews.values()];
    const refilings = refiledOnMerge(filed, from, into);
    this.#refile(refilings);
    this.#topics.delete(from);
    return { topic, into, refiled: refilings.map(({ id }) => id), added: addedOnMerge(filed, from, into) };
  }

  async restoreTopic(merge: TopicMerge) {
    this.#refile(refiledOnRestore([...this.#overviews.values()], merge));
    this.#topics.set(merge.topic.id, merge.topic);
  }

  async deleteTopic(id: TopicId) {
    if (this.#topics.delete(id)) {
      this.#refile(refiledOnMerge([...this.#overviews.values()], id, null));
    }
  }

  #refile(refilings: readonly Refiling[]): void {
    for (const { id, topicIds } of refilings) {
      const overview = this.#overviews.get(id);
      if (overview) {
        this.#overviews.set(id, { ...overview, topicIds });
      }
    }
  }

  async getOverviewState(overviewId: OverviewId) {
    return this.#states.get(overviewId) ?? { overviewId, ...DEFAULT_OVERVIEW_STATE };
  }

  async listOverviewStates() {
    return [...this.#states.values()];
  }

  async setOverviewState(overviewId: OverviewId, patch: Partial<Pick<OverviewState, "read" | "favourite" | "userTags" | "asked">>) {
    const current = await this.getOverviewState(overviewId);
    this.#states.set(overviewId, { ...current, ...patch });
  }
}

defineOverviewStoreConformanceSuite("InMemoryOverviewStore (reference)", () => ({
  store: new InMemoryOverviewStore(),
}));
