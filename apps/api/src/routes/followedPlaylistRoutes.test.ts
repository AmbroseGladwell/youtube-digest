import test from "node:test";
import assert from "node:assert/strict";
import { CURRENT_SCHEMA_VERSIONS } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";

const followed = (overrides: Record<string, unknown> = {}) => ({
  id: "PLpsychology",
  title: "Psychology",
  owner: "Veritasium",
  privacy: "public",
  followedAt: "2026-10-05T09:00:00.000Z",
  unavailable: null,
  schemaVersion: CURRENT_SCHEMA_VERSIONS.followedPlaylist,
  updatedAt: "2026-10-05T09:00:00.000Z",
  ...overrides,
});

test("following a playlist answers 201 and the feed carries it to every device", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/followed-playlists", body: followed() });

  assert.equal(response.statusCode, 201);
  assert.equal((await account.change("followedPlaylist", "PLpsychology")).body!.title, "Psychology");
  await testApp.close();
});

test("replacing a followed playlist needs the revision it was read at", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  await account.inject({ method: "POST", url: "/api/followed-playlists", body: followed() });

  const blind = await account.inject({ method: "POST", url: "/api/followed-playlists", body: followed({ unavailable: "private" }) });
  const matched = await account.inject({
    method: "POST",
    url: "/api/followed-playlists",
    body: followed({ unavailable: "private" }),
    ifMatch: 1,
  });

  assert.equal(blind.statusCode, 409);
  assert.equal(matched.statusCode, 200);
  assert.equal((await account.change("followedPlaylist", "PLpsychology")).body!.unavailable, "private");
  await testApp.close();
});

test("unfollowing leaves a tombstone in the feed, and unfollowing again is a quiet no-op", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  await account.inject({ method: "POST", url: "/api/followed-playlists", body: followed() });

  const first = await account.inject({ method: "DELETE", url: "/api/followed-playlists/PLpsychology" });
  const again = await account.inject({ method: "DELETE", url: "/api/followed-playlists/PLpsychology" });

  assert.equal(first.statusCode, 200);
  assert.equal(again.statusCode, 204);
  assert.equal((await account.change("followedPlaylist", "PLpsychology")).deleted, true);
  await testApp.close();
});

test("a followed playlist that fails the schema is refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/followed-playlists", body: followed({ privacy: "private" }) });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});

test("a client built before playlists could be followed is never sent one, and its feed still moves past it", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  await account.inject({ method: "POST", url: "/api/followed-playlists", body: followed() });
  await account.inject({ method: "PUT", url: "/api/settings", body: { readerContext: "cook", updatedAt: "2026-10-05T09:01:00.000Z" } });

  const response = await account.inject({ method: "GET", url: "/api/changes?since=0", clientVersion: 3 });

  assert.deepEqual(response.json().changes.map((change: { kind: string }) => change.kind), ["settings"]);
  assert.equal(response.json().next, 2);
  await testApp.close();
});
