import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, ShareToken, type Samples, type Share } from "@overview/domain";
import { makeOverview, makeStoredTranscript } from "@overview/store-conformance";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";

const VIDEO = ShareToken.parse("sampleVideo00001");
const ARTICLE = ShareToken.parse("sampleArticle001");
const NEVER_MADE = ShareToken.parse("sampleNeverMade1");

const signedOut = (app: TestApp, url: string) =>
  app.app.inject({ method: "GET", url, headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) } });

// The house account shares an overview, and the link is given the token config lists, which a
// real share would have been minted with.
const shareAs = async (app: TestApp, house: TestAccount, token: ShareToken, title: string): Promise<void> => {
  const overview = makeOverview({ source: { ...makeOverview().source, title } });
  const made: Share = (
    await house.inject({ method: "POST", url: "/api/shares", body: { overview, transcript: makeStoredTranscript() } })
  ).json();
  await app.sql.query("update shares set token = $1 where token = $2", [token, made.token]);
};

test("Start's samples are the live shares config lists, in its order, signed out, without their transcripts", async () => {
  const app = await createTestApp({ sampleShareTokens: [ARTICLE, VIDEO] });
  const house = await makeAccount(app);
  await shareAs(app, house, VIDEO, "A video sample");
  await shareAs(app, house, ARTICLE, "An article sample");

  const response = await signedOut(app, "/api/samples");

  assert.equal(response.statusCode, 200);
  const { samples }: Samples = response.json();
  assert.deepEqual(
    samples.map(({ token, note }) => [token, note.source.title]),
    [
      [ARTICLE, "An article sample"],
      [VIDEO, "A video sample"],
    ],
  );
  assert.equal("transcript" in samples[0]!, false);
  await app.close();
});

test("a sample that isn't a live share is left out, not offered broken", async () => {
  const app = await createTestApp({ sampleShareTokens: [VIDEO, NEVER_MADE] });
  const house = await makeAccount(app);
  await shareAs(app, house, VIDEO, "A video sample");
  await shareAs(app, house, ARTICLE, "Stopped");
  await house.inject({ method: "DELETE", url: `/api/shares/${ARTICLE}` });

  const { samples }: Samples = (await signedOut(app, "/api/samples")).json();

  assert.deepEqual(
    samples.map(({ token }) => token),
    [VIDEO],
  );
  await app.close();
});

test("a chosen sample is the whole copy, transcript included, and counts no visit", async () => {
  const app = await createTestApp({ sampleShareTokens: [VIDEO] });
  const house = await makeAccount(app);
  await shareAs(app, house, VIDEO, "A video sample");

  const response = await signedOut(app, `/api/samples/${VIDEO}`);

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().note.source.title, "A video sample");
  assert.notEqual(response.json().transcript, null);
  const [listed] = (await house.inject({ method: "GET", url: "/api/shares" })).json().shares as Share[];
  assert.equal(listed!.views, 0);
  await app.close();
});

test("a share that isn't a sample can't be read through samples", async () => {
  const app = await createTestApp({ sampleShareTokens: [VIDEO] });
  const house = await makeAccount(app);
  await shareAs(app, house, ARTICLE, "Someone's own share");

  const response = await signedOut(app, `/api/samples/${ARTICLE}`);

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "not_found");
  await app.close();
});

test("with none configured there are no samples", async () => {
  const app = await createTestApp();

  const { samples }: Samples = (await signedOut(app, "/api/samples")).json();

  assert.deepEqual(samples, []);
  await app.close();
});
