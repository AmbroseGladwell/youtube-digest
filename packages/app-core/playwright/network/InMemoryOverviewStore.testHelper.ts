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
} from "@overview/domain";

// A fresh, browser-safe in-memory OverviewStore for IWFT runs — the conformance suite's
// own reference implementation (packages/store-conformance) uses node:crypto, which
// Vite won't bundle for a browser-mounted component, so this is a separate small copy
// rather than a shared import.
export type InMemoryStoreRead = "overviews" | "topics";

export class InMemoryOverviewStore implements OverviewStore {
  #failing = new Set<InMemoryStoreRead>();
  #overviews = new Map<OverviewId, Overview>();
  #topics = new Map<TopicId, Topic>();
  #states = new Map<OverviewId, OverviewState>();

  async getOverview(id: OverviewId) {
    return this.#overviews.get(id) ?? null;
  }

  async listOverviews(query: OverviewQuery = {}) {
    this.#throwIfFailing("overviews");
    return [...this.#overviews.values()].filter((overview) => {
      if (query.unsorted) return overview.topicIds.length === 0;
      if (query.topicId) return overview.topicIds.includes(query.topicId);
      return true;
    });
  }

  async saveOverview(overview: Overview) {
    this.#overviews.set(overview.id, overview);
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
    this.#throwIfFailing("topics");
    return [...this.#topics.values()];
  }

  async createTopic(input: { name: string; description?: string }) {
    const topic: Topic = {
      id: TopicId.parse(crypto.randomUUID()),
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

  #throwIfFailing(read: InMemoryStoreRead): void {
    if (this.#failing.has(read)) throw new Error(`the ${read} read was told to fail`);
  }

  // Test-only seeding helpers — not part of the OverviewStore interface.
  failOn(read: InMemoryStoreRead): void {
    this.#failing.add(read);
  }

  recoverRead(read: InMemoryStoreRead): void {
    this.#failing.delete(read);
  }

  seedOverview(overview: Overview): void {
    this.#overviews.set(overview.id, overview);
  }

  seedTopic(topic: Topic): void {
    this.#topics.set(topic.id, topic);
  }

  seedState(state: OverviewState): void {
    this.#states.set(state.overviewId, state);
  }
}
