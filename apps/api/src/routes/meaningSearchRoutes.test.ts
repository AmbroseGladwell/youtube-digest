import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, MeaningSearchResponse } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { breadNote, conceptEmbedder, foundersNote, noteAbout } from "../testing/meaningFixtures.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";

async function search(account: TestAccount, query: string): Promise<MeaningSearchResponse> {
  const response = await account.inject({ method: "GET", url: `/api/search/meaning?query=${encodeURIComponent(query)}` });
  assert.equal(response.statusCode, 200, response.body);
  return MeaningSearchResponse.parse(response.json());
}

const matchedIds = (result: MeaningSearchResponse) => (result.available ? result.matches.map((match) => match.overviewId) : null);

test("an overview is found by an idea it never puts in those words", async () => {
  const testApp = await createTestApp({}, { embedder: conceptEmbedder() });
  const reader = await makeAccount(testApp);
  const founders = foundersNote();
  await reader.inject({ method: "POST", url: "/api/overviews", body: founders });
  await reader.inject({ method: "POST", url: "/api/overviews", body: breadNote() });
  await testApp.drainEmbeddings();

  assert.deepEqual(matchedIds(await search(reader, "leaders who overstay")), [founders.id]);
  await testApp.close();
});

test("a library with no overviews answers with no matches", async () => {
  const testApp = await createTestApp({}, { embedder: conceptEmbedder() });
  const reader = await makeAccount(testApp);
  await testApp.drainEmbeddings();

  assert.deepEqual(await search(reader, "leaders who overstay"), { available: true, matches: [] });
  await testApp.close();
});

test("a library of one overview finds it, or nothing when the idea is elsewhere", async () => {
  const testApp = await createTestApp({}, { embedder: conceptEmbedder() });
  const reader = await makeAccount(testApp);
  const bread = breadNote();
  await reader.inject({ method: "POST", url: "/api/overviews", body: bread });
  await testApp.drainEmbeddings();

  assert.deepEqual(matchedIds(await search(reader, "baking")), [bread.id]);
  assert.deepEqual(matchedIds(await search(reader, "leaders who overstay")), []);
  await testApp.close();
});

test("a search never reaches another reader's overviews", async () => {
  const testApp = await createTestApp({}, { embedder: conceptEmbedder() });
  const other = await makeAccount(testApp);
  const reader = await makeAccount(testApp);
  await other.inject({ method: "POST", url: "/api/overviews", body: foundersNote() });
  await testApp.drainEmbeddings();

  assert.deepEqual(matchedIds(await search(reader, "leaders who overstay")), []);
  await testApp.close();
});

test("a regenerated overview is matched on what it says now, never on what it said before", async () => {
  const testApp = await createTestApp({}, { embedder: conceptEmbedder() });
  const reader = await makeAccount(testApp);
  const before = foundersNote();
  await reader.inject({ method: "POST", url: "/api/overviews", body: before });
  await testApp.drainEmbeddings();
  const regenerated = noteAbout("A sourdough loaf needs patience", ["Feed it", "Fold it", "Bake it"], {
    id: before.id,
    source: before.source,
  });
  const rewrite = await reader.inject({ method: "POST", url: "/api/overviews", body: regenerated, ifMatch: 1 });
  assert.equal(rewrite.statusCode, 200, rewrite.body);

  assert.deepEqual(matchedIds(await search(reader, "leaders who overstay")), []);
  await testApp.drainEmbeddings();
  assert.deepEqual(matchedIds(await search(reader, "leaders who overstay")), []);
  assert.deepEqual(matchedIds(await search(reader, "baking")), [before.id]);
  await testApp.close();
});

test("a deleted overview is no longer found", async () => {
  const testApp = await createTestApp({}, { embedder: conceptEmbedder() });
  const reader = await makeAccount(testApp);
  const founders = foundersNote();
  await reader.inject({ method: "POST", url: "/api/overviews", body: founders });
  await testApp.drainEmbeddings();
  await reader.inject({ method: "DELETE", url: `/api/overviews/${founders.id}`, ifMatch: 1 });
  await testApp.drainEmbeddings();

  assert.deepEqual(matchedIds(await search(reader, "leaders who overstay")), []);
  const rows = await testApp.sql.query<{ count: number }>("select count(*)::int as count from claim_embeddings");
  assert.equal(rows[0]?.count, 0);
  await testApp.close();
});

test("rewriting an overview embeds only the claims that changed", async () => {
  const embedder = conceptEmbedder();
  const testApp = await createTestApp({}, { embedder });
  const reader = await makeAccount(testApp);
  const founders = foundersNote();
  await reader.inject({ method: "POST", url: "/api/overviews", body: founders });
  await testApp.drainEmbeddings();
  const changed = {
    ...founders,
    keyPoints: [...founders.keyPoints.slice(0, 2), { text: "Entrenched leaders resist change", range: null }],
  };
  await reader.inject({ method: "POST", url: "/api/overviews", body: changed, ifMatch: 1 });
  await testApp.drainEmbeddings();

  assert.deepEqual(embedder.calls.at(-1), ["Entrenched leaders resist change"]);
  await testApp.close();
});

test("an overview whose embedding failed is embedded when it is tried again", async () => {
  const embedder = conceptEmbedder();
  embedder.failing = true;
  const testApp = await createTestApp({}, { embedder });
  const reader = await makeAccount(testApp);
  const founders = foundersNote();
  await reader.inject({ method: "POST", url: "/api/overviews", body: founders });
  await testApp.drainEmbeddings();
  embedder.failing = false;
  testApp.clock.advance(2 * 60_000);
  await testApp.drainEmbeddings();

  assert.deepEqual(matchedIds(await search(reader, "leaders who overstay")), [founders.id]);
  await testApp.close();
});

test("search says meaning is unavailable when the embedder cannot answer", async () => {
  const embedder = conceptEmbedder();
  const testApp = await createTestApp({}, { embedder });
  const reader = await makeAccount(testApp);
  embedder.failing = true;

  assert.deepEqual(await search(reader, "leaders who overstay"), { available: false });
  await testApp.close();
});

test("search says meaning is unavailable on a server with no embedder", async () => {
  const testApp = await createTestApp();
  const reader = await makeAccount(testApp);

  assert.deepEqual(await search(reader, "leaders who overstay"), { available: false });
  await testApp.close();
});

test("an empty search is refused", async () => {
  const testApp = await createTestApp({}, { embedder: conceptEmbedder() });
  const reader = await makeAccount(testApp);
  const response = await reader.inject({ method: "GET", url: "/api/search/meaning?query=%20" });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});

test("searching by meaning needs a session", async () => {
  const testApp = await createTestApp({}, { embedder: conceptEmbedder() });
  const response = await testApp.app.inject({
    method: "GET",
    url: "/api/search/meaning?query=leaders",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
  });

  assert.equal(response.statusCode, 401);
  await testApp.close();
});
