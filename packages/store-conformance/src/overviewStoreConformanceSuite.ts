import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { OverviewId, TopicId, type OverviewStore } from "@overview/types";
import { makeOverview } from "./makeOverview.js";

export function defineOverviewStoreConformanceSuite(
  label: string,
  createStore: () => OverviewStore | Promise<OverviewStore>,
): void {
  const behaviour = (description: string) => `${label} OverviewStore: ${description}`;

  test(behaviour("saveOverview then getOverview round-trips the overview"), async () => {
    const store = await createStore();
    const overview = makeOverview();
    await store.saveOverview(overview);
    assert.deepEqual(await store.getOverview(overview.id), overview);
  });

  test(behaviour("getOverview returns null for an id nobody has saved"), async () => {
    const store = await createStore();
    assert.equal(await store.getOverview(OverviewId.parse(randomUUID())), null);
  });

  test(behaviour("an overview with no topics shows up under an unsorted query"), async () => {
    const store = await createStore();
    await store.saveOverview(makeOverview());
    assert.equal((await store.listOverviews({ unsorted: true })).length, 1);
  });

  test(behaviour("filing an overview under a topic removes it from the unsorted query"), async () => {
    const store = await createStore();
    const topicId = TopicId.parse(randomUUID());
    await store.saveOverview(makeOverview({ topicIds: [topicId] }));
    assert.equal((await store.listOverviews({ unsorted: true })).length, 0);
    assert.equal((await store.listOverviews({ topicId })).length, 1);
  });

  test(behaviour("listOverviews with no query returns every saved overview, filed or not"), async () => {
    const store = await createStore();
    const topicId = TopicId.parse(randomUUID());
    await store.saveOverview(makeOverview());
    await store.saveOverview(makeOverview({ topicIds: [topicId] }));
    assert.equal((await store.listOverviews()).length, 2);
  });

  test(behaviour("saveOverview replaces the overview wholesale but never touches its read/favourite state"), async () => {
    const store = await createStore();
    const overview = makeOverview();
    await store.saveOverview(overview);
    await store.setOverviewState(overview.id, { read: true, favourite: true });

    await store.saveOverview({ ...overview, coreClaim: "A revised claim after regeneration." });

    const state = await store.getOverviewState(overview.id);
    assert.equal(state.read, true);
    assert.equal(state.favourite, true);
  });

  test(behaviour("a user-added tag survives regeneration, because it never lived on the overview"), async () => {
    const store = await createStore();
    const overview = makeOverview();
    await store.saveOverview(overview);
    await store.setOverviewState(overview.id, { userTags: ["re-watch"] });

    await store.saveOverview({ ...overview, tags: ["fresh-tag", "another-tag", "third-tag"] });

    const state = await store.getOverviewState(overview.id);
    assert.deepEqual(state.userTags, ["re-watch"]);
  });

  test(behaviour("setOverviewState merges a patch onto the existing state, it does not replace it"), async () => {
    const store = await createStore();
    const overview = makeOverview();
    await store.saveOverview(overview);
    await store.setOverviewState(overview.id, { read: true });
    await store.setOverviewState(overview.id, { favourite: true });

    const state = await store.getOverviewState(overview.id);
    assert.equal(state.read, true);
    assert.equal(state.favourite, true);
  });

  test(
    behaviour("getOverviewState defaults to unread, unfavourited, and no user tags for an overview nobody has touched"),
    async () => {
      const store = await createStore();
      const overviewId = OverviewId.parse(randomUUID());
      assert.deepEqual(await store.getOverviewState(overviewId), {
        overviewId,
        read: false,
        favourite: false,
        userTags: [],
      });
    },
  );

  test(behaviour("deleteOverview removes it from getOverview and from listOverviews"), async () => {
    const store = await createStore();
    const overview = makeOverview();
    await store.saveOverview(overview);
    await store.deleteOverview(overview.id);
    assert.equal(await store.getOverview(overview.id), null);
    assert.equal((await store.listOverviews()).length, 0);
  });

  test(behaviour("deleting an overview that was never saved does not throw"), async () => {
    const store = await createStore();
    await assert.doesNotReject(() => store.deleteOverview(OverviewId.parse(randomUUID())));
  });

  test(behaviour("saving an overview with an unfamiliar topicId does not create that topic"), async () => {
    const store = await createStore();
    await store.saveOverview(makeOverview({ topicIds: [TopicId.parse(randomUUID())] }));
    assert.deepEqual(await store.listTopics(), []);
  });

  test(behaviour("createTopic is the only way a topic is added to the list"), async () => {
    const store = await createStore();
    const topic = await store.createTopic({ name: "fitness" });
    assert.deepEqual(await store.listTopics(), [topic]);
  });

  test(behaviour("listClaims returns a lightweight projection, not full overviews"), async () => {
    const store = await createStore();
    const overview = makeOverview();
    await store.saveOverview(overview);
    assert.deepEqual(await store.listClaims(), [
      { overviewId: overview.id, title: overview.video.title, claim: overview.coreClaim },
    ]);
  });

  test(behaviour("listClaims reflects every saved overview, not just the most recent one"), async () => {
    const store = await createStore();
    const first = makeOverview();
    const second = makeOverview();
    await store.saveOverview(first);
    await store.saveOverview(second);
    const claims = await store.listClaims();
    assert.equal(claims.length, 2);
    assert.ok(claims.some((claim) => claim.overviewId === first.id));
    assert.ok(claims.some((claim) => claim.overviewId === second.id));
  });
}
