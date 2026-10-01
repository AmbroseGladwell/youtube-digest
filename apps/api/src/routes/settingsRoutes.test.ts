import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { UPDATED_AT } from "../testing/storedRecords.testHelper.js";

test("the first settings patch starts from the defaults", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "PUT",
    url: "/api/settings",
    body: { readerContext: "A parent of two", updatedAt: UPDATED_AT },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual((await account.change("settings", "settings")).body, {
    ...DEFAULT_SETTINGS,
    readerContext: "A parent of two",
  });
  await testApp.close();
});

test("patching one toggle keeps the others, including one a newer client added", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  await account.seedRaw("settings", "settings", 1, {
    ...DEFAULT_SETTINGS,
    sectionsEnabled: { ...DEFAULT_SETTINGS.sectionsEnabled, chapters: false },
  });

  await account.inject({
    method: "PUT",
    url: "/api/settings",
    body: { sectionsEnabled: { verdict: false }, updatedAt: UPDATED_AT },
  });

  assert.deepEqual((await account.change("settings", "settings")).body!.sectionsEnabled, {
    ...DEFAULT_SETTINGS.sectionsEnabled,
    verdict: false,
    chapters: false,
  });
  await testApp.close();
});

test("dismissing one milestone keeps the ones another device crossed", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const crossed = { crossedAt: "2026-10-01T09:00:00.000Z", dismissedAt: null };
  await account.seedRaw("settings", "settings", 1, { ...DEFAULT_SETTINGS, milestones: { "30m": crossed, "1h": crossed } });

  const response = await account.inject({
    method: "PUT",
    url: "/api/settings",
    body: { milestones: { "30m": { ...crossed, dismissedAt: "2026-10-01T10:00:00.000Z" } }, updatedAt: UPDATED_AT },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual((await account.change("settings", "settings")).body!.milestones, {
    "30m": { ...crossed, dismissedAt: "2026-10-01T10:00:00.000Z" },
    "1h": crossed,
  });
  await testApp.close();
});

test("a settings patch that changes nothing, or names a setting that does not exist, is refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const empty = await account.inject({ method: "PUT", url: "/api/settings", body: { updatedAt: UPDATED_AT } });
  assert.equal(empty.statusCode, 400);

  const unknown = await account.inject({
    method: "PUT",
    url: "/api/settings",
    body: { theme: "dark", updatedAt: UPDATED_AT },
  });
  assert.equal(unknown.statusCode, 400);
  await testApp.close();
});

test("the chosen narration voice is kept in the synced settings, so it follows the reader to every device", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "PUT",
    url: "/api/settings",
    body: { narrationVoice: "bm_george", updatedAt: UPDATED_AT },
  });

  assert.equal(response.statusCode, 200);
  assert.equal((await account.change("settings", "settings")).body?.narrationVoice, "bm_george");
  await testApp.close();
});
