import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { OverviewStore, OverviewQuery, ClaimSummary } from "./OverviewStore.js";
import type { Overview } from "./Overview.js";
import type { Topic } from "./Topic.js";
import { DEFAULT_OVERVIEW_STATE, type OverviewState } from "./OverviewState.js";
import { OverviewId, TopicId, VideoId } from "./Brands.js";

// Test-only reference implementation, not exported - real stores live elsewhere.
class InMemoryOverviewStore implements OverviewStore {
  #overviews = new Map<OverviewId, Overview>();
  #topics = new Map<TopicId, Topic>();
  #states = new Map<OverviewId, OverviewState>();

  async getOverview(id: OverviewId) {
    return this.#overviews.get(id) ?? null;
  }

  async listUnreadable() {
    return [];
  }

  async listOverviews(query: OverviewQuery = {}) {
    return [...this.#overviews.values()].filter((overview) => {
      if (query.unsorted) return overview.topicIds.length === 0;
      if (query.topicId) return overview.topicIds.includes(query.topicId);
      return true;
    });
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

const OVERVIEW_ID = OverviewId.parse(randomUUID());
const NEVER_SEEN_OVERVIEW_ID = OverviewId.parse(randomUUID());
const FITNESS_TOPIC_ID = TopicId.parse(randomUUID());
const UNKNOWN_TOPIC_ID = TopicId.parse(randomUUID());

const exampleOverview: Overview = {
  id: OVERVIEW_ID,
  video: {
    id: VideoId.parse("example"),
    url: "https://www.youtube.com/watch?v=example",
    title: "Example",
    channel: "Example Channel",
    description: null,
    durationMs: null,
    publishedAt: null,
    thumbnailUrl: null,
  },
  savedAt: new Date().toISOString(),
  captureReason: null,
  inOneLine: "A short description of the video.",
  coreClaim: "The single assertion this video makes.",
  thin: false,
  keyPoints: ["one", "two", "three"],
  topicIds: [],
  tags: ["one-tag", "two-tag", "three-tag"],
  verdict: null,
  selling: null,
  howToApply: null,
  watchAnyway: null,
};

test("an overview with no topics shows up under an unsorted query", async () => {
  const store = new InMemoryOverviewStore();
  await store.saveOverview(exampleOverview);
  const unsorted = await store.listOverviews({ unsorted: true });
  assert.equal(unsorted.length, 1);
});

test("filing an overview under a topic removes it from the unsorted query", async () => {
  const store = new InMemoryOverviewStore();
  await store.saveOverview({ ...exampleOverview, topicIds: [FITNESS_TOPIC_ID] });
  assert.equal((await store.listOverviews({ unsorted: true })).length, 0);
  assert.equal((await store.listOverviews({ topicId: FITNESS_TOPIC_ID })).length, 1);
});

test("saveOverview replaces the overview wholesale but never touches its read/favourite state", async () => {
  const store = new InMemoryOverviewStore();
  await store.saveOverview(exampleOverview);
  await store.setOverviewState(OVERVIEW_ID, { read: true, favourite: true });

  await store.saveOverview({
    ...exampleOverview,
    coreClaim: "A revised claim after regeneration.",
  });

  const state = await store.getOverviewState(OVERVIEW_ID);
  assert.equal(state.read, true);
  assert.equal(state.favourite, true);
});

test("a user-added tag survives regeneration, because it never lived on the overview", async () => {
  const store = new InMemoryOverviewStore();
  await store.saveOverview(exampleOverview);
  await store.setOverviewState(OVERVIEW_ID, { userTags: ["re-watch"] });

  await store.saveOverview({
    ...exampleOverview,
    tags: ["fresh-tag", "another-tag", "third-tag"],
  });

  const state = await store.getOverviewState(OVERVIEW_ID);
  assert.deepEqual(state.userTags, ["re-watch"]);
});

test("getOverviewState defaults to unread, unfavourited, and no user tags for an overview nobody has touched", async () => {
  const store = new InMemoryOverviewStore();
  const state = await store.getOverviewState(NEVER_SEEN_OVERVIEW_ID);
  assert.deepEqual(state, {
    overviewId: NEVER_SEEN_OVERVIEW_ID,
    read: false,
    favourite: false,
    userTags: [],
  });
});

test("saving an overview with an unfamiliar topicId does not create that topic", async () => {
  const store = new InMemoryOverviewStore();
  await store.saveOverview({ ...exampleOverview, topicIds: [UNKNOWN_TOPIC_ID] });
  assert.deepEqual(await store.listTopics(), []);
});

test("createTopic is the only way a topic is added to the list", async () => {
  const store = new InMemoryOverviewStore();
  const topic = await store.createTopic({ name: "fitness" });
  assert.deepEqual(await store.listTopics(), [topic]);
});

test("listClaims returns a lightweight projection, not full overviews", async () => {
  const store = new InMemoryOverviewStore();
  await store.saveOverview(exampleOverview);
  const claims = await store.listClaims();
  assert.deepEqual(claims, [
    { overviewId: OVERVIEW_ID, title: "Example", claim: "The single assertion this video makes." },
  ]);
});
