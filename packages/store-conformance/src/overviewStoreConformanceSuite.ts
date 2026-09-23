import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  CURRENT_OVERVIEW_SCHEMA_VERSION,
  OVERVIEW_CORPUS,
  OverviewId,
  TopicId,
  UnreadableRecordError,
  type OverviewStore,
} from "@overview/domain";
import { makeOverview } from "./makeOverview.js";

// A store that can be handed a record it did not write is the only kind that can be asked
// whether it runs the migration chain on read. Implementations that cannot do that (an
// API client behind a network, say) leave the hook out and skip those checks
// (docs/features/record-migrations.md).
export interface OverviewStoreUnderTest {
  store: OverviewStore;
  seedRawOverview?: ((raw: unknown) => Promise<void>) | undefined;
}

export function defineOverviewStoreConformanceSuite(
  label: string,
  createStoreUnderTest: () => OverviewStoreUnderTest | Promise<OverviewStoreUnderTest>,
): void {
  const behaviour = (description: string) => `${label} OverviewStore: ${description}`;
  const createStore = async () => (await createStoreUnderTest()).store;

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

  test(behaviour("listUnreadable is empty for a store holding only records it wrote itself"), async () => {
    const store = await createStore();
    await store.saveOverview(makeOverview());
    assert.deepEqual(await store.listUnreadable(), []);
  });

  test(behaviour("setOverviewTopics files the overview without touching anything else on it"), async () => {
    const store = await createStore();
    const overview = makeOverview();
    const topicId = TopicId.parse(randomUUID());
    await store.saveOverview(overview);

    await store.setOverviewTopics(overview.id, [topicId]);

    assert.deepEqual(await store.getOverview(overview.id), { ...overview, topicIds: [topicId] });
  });

  test(behaviour("setOverviewTopics on an id nobody has saved does not create one"), async () => {
    const store = await createStore();
    const overviewId = OverviewId.parse(randomUUID());
    await store.setOverviewTopics(overviewId, [TopicId.parse(randomUUID())]);
    assert.equal(await store.getOverview(overviewId), null);
  });

  defineMigrationChecks(behaviour, createStoreUnderTest);
}

const corpusAt = (version: number): Record<string, unknown> => {
  const record = OVERVIEW_CORPUS.get(version);
  if (typeof record !== "object" || record === null) {
    throw new Error(`no corpus record at version ${version}`);
  }
  return record as Record<string, unknown>;
};

function defineMigrationChecks(
  behaviour: (description: string) => string,
  createStoreUnderTest: () => OverviewStoreUnderTest | Promise<OverviewStoreUnderTest>,
): void {
  const oldRecord = corpusAt(1);
  const oldRecordId = OverviewId.parse(oldRecord.id as string);

  const seeded = async (raw: unknown): Promise<OverviewStore | null> => {
    const underTest = await createStoreUnderTest();
    if (!underTest.seedRawOverview) {
      return null;
    }
    await underTest.seedRawOverview(raw);
    return underTest.store;
  };

  test(behaviour("a record written by an older schema is migrated on read, not handed back raw"), async () => {
    const store = await seeded(oldRecord);
    if (!store) return;

    const overview = await store.getOverview(oldRecordId);

    assert.ok(overview);
    assert.equal(overview.video.durationMs, null);
    assert.equal(overview.video.publishedAt, null);
    assert.equal(overview.video.thumbnailUrl, null);
    assert.equal((await store.listOverviews()).length, 1);
    assert.deepEqual(await store.listUnreadable(), []);
  });

  test(behaviour("a record written by a newer schema is held back and counted, never listed"), async () => {
    const store = await seeded({
      ...oldRecord,
      schemaVersion: CURRENT_OVERVIEW_SCHEMA_VERSION + 1,
    });
    if (!store) return;

    assert.deepEqual(await store.listOverviews(), []);
    const unreadable = await store.listUnreadable();
    assert.equal(unreadable.length, 1);
    assert.equal(unreadable[0]?.reason, "future-version");
    assert.equal(unreadable[0]?.id, oldRecordId);
  });

  test(behaviour("a record that cannot be parsed is quarantined rather than dropped"), async () => {
    const store = await seeded({ ...oldRecord, coreClaim: 7 });
    if (!store) return;

    assert.deepEqual(await store.listOverviews(), []);
    const unreadable = await store.listUnreadable();
    assert.equal(unreadable.length, 1);
    assert.equal(unreadable[0]?.reason, "invalid");
  });

  test(behaviour("an unreadable record keeps whatever of its video can be salvaged"), async () => {
    const store = await seeded({ ...oldRecord, coreClaim: 7 });
    if (!store) return;

    const [unreadable] = await store.listUnreadable();

    assert.equal(unreadable?.salvaged?.video?.title, (oldRecord.video as { title: string }).title);
    assert.equal(unreadable?.salvaged?.savedAt, oldRecord.savedAt);
  });

  test(behaviour("getOverview throws for an unreadable record rather than reporting it absent"), async () => {
    const store = await seeded({ ...oldRecord, coreClaim: 7 });
    if (!store) return;

    await assert.rejects(() => store.getOverview(oldRecordId), UnreadableRecordError);
  });

  test(behaviour("setOverviewTopics refuses a record this client cannot read"), async () => {
    const store = await seeded({
      ...oldRecord,
      schemaVersion: CURRENT_OVERVIEW_SCHEMA_VERSION + 1,
    });
    if (!store) return;

    await assert.rejects(
      () => store.setOverviewTopics(oldRecordId, [TopicId.parse(randomUUID())]),
      UnreadableRecordError,
    );
  });
}
