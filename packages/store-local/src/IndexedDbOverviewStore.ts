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
} from "@overview/types";
import { OVERVIEWS_STORE, OVERVIEW_STATES_STORE, TOPICS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";

export class IndexedDbOverviewStore implements OverviewStore {
  #db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.#db = db;
  }

  async getOverview(id: OverviewId) {
    const store = this.#db.transaction(OVERVIEWS_STORE, "readonly").objectStore(OVERVIEWS_STORE);
    const overview = await promisifyRequest<Overview | undefined>(store.get(id));
    return overview ?? null;
  }

  async listOverviews(query: OverviewQuery = {}) {
    const store = this.#db.transaction(OVERVIEWS_STORE, "readonly").objectStore(OVERVIEWS_STORE);
    const overviews = await promisifyRequest<Overview[]>(store.getAll());
    return overviews.filter((overview) => {
      if (query.unsorted) return overview.topicIds.length === 0;
      if (query.topicId) return overview.topicIds.includes(query.topicId);
      return true;
    });
  }

  async saveOverview(overview: Overview) {
    const store = this.#db.transaction(OVERVIEWS_STORE, "readwrite").objectStore(OVERVIEWS_STORE);
    await promisifyRequest(store.put(overview));
  }

  async deleteOverview(id: OverviewId) {
    const store = this.#db.transaction(OVERVIEWS_STORE, "readwrite").objectStore(OVERVIEWS_STORE);
    await promisifyRequest(store.delete(id));
  }

  async listClaims(): Promise<ClaimSummary[]> {
    const overviews = await this.listOverviews();
    return overviews.map((overview) => ({
      overviewId: overview.id,
      title: overview.video.title,
      claim: overview.coreClaim,
    }));
  }

  async listTopics() {
    const store = this.#db.transaction(TOPICS_STORE, "readonly").objectStore(TOPICS_STORE);
    return promisifyRequest<Topic[]>(store.getAll());
  }

  async createTopic(input: { name: string; description?: string }) {
    const topic: Topic = {
      id: TopicId.parse(crypto.randomUUID()),
      name: input.name,
      description: input.description ?? null,
      createdAt: new Date().toISOString(),
    };
    const store = this.#db.transaction(TOPICS_STORE, "readwrite").objectStore(TOPICS_STORE);
    await promisifyRequest(store.put(topic));
    return topic;
  }

  async getOverviewState(overviewId: OverviewId) {
    const store = this.#db.transaction(OVERVIEW_STATES_STORE, "readonly").objectStore(OVERVIEW_STATES_STORE);
    const state = await promisifyRequest<Partial<OverviewState> | undefined>(store.get(overviewId));
    return { ...DEFAULT_OVERVIEW_STATE, ...state, overviewId };
  }

  async setOverviewState(
    overviewId: OverviewId,
    patch: Partial<Pick<OverviewState, "read" | "favourite" | "userTags">>,
  ) {
    const current = await this.getOverviewState(overviewId);
    const store = this.#db.transaction(OVERVIEW_STATES_STORE, "readwrite").objectStore(OVERVIEW_STATES_STORE);
    await promisifyRequest(store.put({ ...current, ...patch }));
  }
}
