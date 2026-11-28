import test from "node:test";
import assert from "node:assert/strict";
import { CURRENT_SCHEMA_VERSIONS, feedIdOf, MOST_FEEDS_FOLLOWED } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";

const FEED_URL = "https://blog.example/feed.xml";

const followed = async (feedUrl = FEED_URL, overrides: Record<string, unknown> = {}) => ({
  id: await feedIdOf(feedUrl),
  feedUrl,
  kind: "blog",
  title: "A blog",
  siteUrl: "https://blog.example/",
  imageUrl: null,
  followedAt: "2026-11-28T09:00:00.000Z",
  pace: "whenChosen",
  order: "newestFirst",
  unavailable: null,
  schemaVersion: CURRENT_SCHEMA_VERSIONS.followedFeed,
  updatedAt: "2026-11-28T09:00:00.000Z",
  ...overrides,
});

test("following a feed answers 201 and the feed of changes carries it to every device", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/followed-feeds", body: await followed() });

  assert.equal(response.statusCode, 201);
  assert.equal((await account.change("followedFeed", await feedIdOf(FEED_URL))).body!.title, "A blog");
  await testApp.close();
});

test("a second device following the same feed names the same record, so it is told to replace rather than following twice", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  await account.inject({ method: "POST", url: "/api/followed-feeds", body: await followed() });

  const again = await account.inject({ method: "POST", url: "/api/followed-feeds", body: await followed() });
  const replaced = await account.inject({
    method: "POST",
    url: "/api/followed-feeds",
    body: await followed(FEED_URL, { unavailable: "gone" }),
    ifMatch: 1,
  });

  assert.equal(again.statusCode, 409);
  assert.equal(again.json().error.code, "already_exists");
  assert.equal(replaced.statusCode, 200);
  await testApp.close();
});

test("an id that isn't the hash of the feed's address is refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: "/api/followed-feeds",
    body: await followed(FEED_URL, { feedUrl: "https://elsewhere.example/feed.xml" }),
  });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});

test(`the ${MOST_FEEDS_FOLLOWED + 1}st feed is refused, while one already followed can still change and an unfollowed one frees a place`, async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const urls = Array.from({ length: MOST_FEEDS_FOLLOWED + 1 }, (_, index) => `https://blog${index}.example/feed.xml`);
  for (const url of urls.slice(0, MOST_FEEDS_FOLLOWED)) {
    await account.inject({ method: "POST", url: "/api/followed-feeds", body: await followed(url) });
  }

  const over = await account.inject({ method: "POST", url: "/api/followed-feeds", body: await followed(urls.at(-1)) });
  const changed = await account.inject({
    method: "POST",
    url: "/api/followed-feeds",
    body: await followed(urls[0], { pace: "oneADay" }),
    ifMatch: 1,
  });
  await account.inject({ method: "DELETE", url: `/api/followed-feeds/${await feedIdOf(urls[1]!)}` });
  const afterUnfollowing = await account.inject({ method: "POST", url: "/api/followed-feeds", body: await followed(urls.at(-1)) });

  assert.equal(over.statusCode, 409);
  assert.deepEqual([over.json().error.code, over.json().error.details.limit], ["feed_limit_reached", MOST_FEEDS_FOLLOWED]);
  assert.equal(changed.statusCode, 200);
  assert.equal(afterUnfollowing.statusCode, 201);
  await testApp.close();
});

test("unfollowing leaves a tombstone, and unfollowing again is a quiet no-op", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const id = await feedIdOf(FEED_URL);
  await account.inject({ method: "POST", url: "/api/followed-feeds", body: await followed() });

  const first = await account.inject({ method: "DELETE", url: `/api/followed-feeds/${id}` });
  const again = await account.inject({ method: "DELETE", url: `/api/followed-feeds/${id}` });

  assert.equal(first.statusCode, 200);
  assert.equal(again.statusCode, 204);
  assert.equal((await account.change("followedFeed", id)).deleted, true);
  await testApp.close();
});

test("a followed feed that fails the schema is refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: "/api/followed-feeds",
    body: await followed(FEED_URL, { kind: "newsletter" }),
  });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});

test("a client built before feeds could be followed is never sent one, and its feed of changes still moves past it", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  await account.inject({ method: "POST", url: "/api/followed-feeds", body: await followed() });
  await account.inject({ method: "PUT", url: "/api/settings", body: { readerContext: "cook", updatedAt: "2026-11-28T09:01:00.000Z" } });

  const response = await account.inject({ method: "GET", url: "/api/changes?since=0", clientVersion: 32 });

  assert.deepEqual(
    response.json().changes.map((change: { kind: string }) => change.kind),
    ["settings"],
  );
  assert.equal(response.json().next, 2);
  await testApp.close();
});
