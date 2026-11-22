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
  UnreadableRecordError,
} from "@overview/domain";

// Not the conformance suite's store: that uses node:crypto, which Vite won't bundle for the browser.
export type InMemoryStoreRead = "overviews" | "topics";

export class InMemoryOverviewStore implements OverviewStore {
  #failing = new Set<InMemoryStoreRead>();
  #failingStateWrites = new Set<OverviewId>();
  #overviews = new Map<OverviewId, Overview>();
  #topics = new Map<TopicId, Topic>();
  #states = new Map<OverviewId, OverviewState>();
  #unreadable: UnreadableRecord[] = [];

  async getOverview(id: OverviewId) {
    const unreadable = this.#unreadable.find((record) => record.id === id);
    if (unreadable) {
      throw new UnreadableRecordError(unreadable);
    }
    return this.#overviews.get(id) ?? null;
  }

  async listOverviews(query: OverviewQuery = {}) {
    this.#throwIfFailing("overviews");
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
    this.#throwIfFailing("overviews");
    return [...this.#unreadable];
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

  async setOverviewTags(overviewId: OverviewId, tags: string[]) {
    const overview = this.#overviews.get(overviewId);
    if (overview) {
      this.#overviews.set(overviewId, { ...overview, tags });
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

  async listOverviewStates() {
    return [...this.#states.values()];
  }

  async setOverviewState(overviewId: OverviewId, patch: Partial<Pick<OverviewState, "read" | "favourite" | "userTags" | "asked">>) {
    if (this.#failingStateWrites.has(overviewId)) {
      throw new Error(`the state write for ${overviewId} was told to fail`);
    }
    const current = await this.getOverviewState(overviewId);
    this.#states.set(overviewId, { ...current, ...patch });
  }

  #throwIfFailing(read: InMemoryStoreRead): void {
    if (this.#failing.has(read)) {
      throw new Error(`the ${read} read was told to fail`);
    }
  }

  failOn(read: InMemoryStoreRead): void {
    this.#failing.add(read);
  }

  recoverRead(read: InMemoryStoreRead): void {
    this.#failing.delete(read);
  }

  failStateWritesFor(overviewId: OverviewId): void {
    this.#failingStateWrites.add(overviewId);
  }

  seedOverview(overview: Overview): void {
    this.#overviews.set(overview.id, overview);
  }

  seedUnreadable(record: UnreadableRecord): void {
    this.#unreadable.push(record);
  }

  seedTopic(topic: Topic): void {
    this.#topics.set(topic.id, topic);
  }

  seedState(state: OverviewState): void {
    this.#states.set(state.overviewId, state);
  }
}
