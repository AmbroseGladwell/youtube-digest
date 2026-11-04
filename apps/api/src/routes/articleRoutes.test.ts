import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, TRIAL_READS, TRIAL_TOKEN_HEADER } from "@overview/domain";
import type { FetchedPage } from "../articles/fetchArticlePage.js";
import { makeFakeOpenAi } from "../generation/FakeOpenAi.testHelper.js";
import { recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { makeTrialDevice } from "../testing/TrialDevice.testHelper.js";
import { TRIAL_READS_PER_ADDRESS_DAILY } from "../usage/TrialsRepository.js";

const URL_OF_PAGE = "https://news.example.com/bridge";
const paragraphs = Array.from({ length: 30 }, (_, index) => `<p>Paragraph ${index} says the county reused an old survey, and that residents will pay for the repair twice over.</p>`).join("");
const HTML = `<!doctype html><html><head><title>The bridge</title><script>fetch("http://169.254.169.254/");document.title="ran"</script></head><body><article><h1>The bridge</h1>${paragraphs}</article></body></html>`;

const appServing = (page: FetchedPage, logger?: ReturnType<typeof recordingLogger>["logger"]) =>
  createTestApp(
    {},
    {
      fetchArticlePage: async () => page,
      ourKey: { apiKey: "sk-test-ours", dailyGenerations: 300, signedOutDailyGenerations: 50, http: makeFakeOpenAi().http },
      ...(logger === undefined ? {} : { logger }),
    },
  );

const saying = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);
const DAY_MS = 24 * 60 * 60 * 1000;

test("a pasted link comes back as the article, read without running the page's scripts", async () => {
  const testApp = await appServing({ status: "page", url: URL_OF_PAGE, html: HTML });
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/articles/read", body: { url: URL_OF_PAGE } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "read");
  assert.equal(response.json().article.title, "The bridge");
  await testApp.close();
});

test("a page that couldn't be fetched answers with why, not an error", async () => {
  const testApp = await appServing({ status: "failed", reason: "blocked" });
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/articles/read", body: { url: URL_OF_PAGE } });

  assert.deepEqual(response.json(), { status: "failed", reason: "blocked" });
  await testApp.close();
});

test("only an account or a trial can ask our server to fetch something", async () => {
  const testApp = await appServing({ status: "failed", reason: "blocked" });

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/articles/read",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { url: URL_OF_PAGE },
  });

  assert.equal(response.statusCode, 401);
  await testApp.close();
});

test("something that isn't a link is refused", async () => {
  const testApp = await appServing({ status: "failed", reason: "blocked" });
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/articles/read", body: { url: "not a link" } });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});

test("signed out, a trial reads a few links, whether or not they can be read, then is refused as the trial's", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await appServing({ status: "failed", reason: "blocked" }, logger);
  const device = await makeTrialDevice(testApp);

  const read = [];
  for (let n = 0; n < TRIAL_READS; n += 1) read.push((await device.readArticle(URL_OF_PAGE)).statusCode);
  const next = await device.readArticle(URL_OF_PAGE);

  assert.deepEqual(read, Array.from({ length: TRIAL_READS }, () => 200));
  assert.equal(next.statusCode, 429);
  assert.equal(next.json().error.details.quota, "trial-reads");
  assert.equal(saying(lines, "trial reads spent").length, 1);
  await testApp.close();
});

test("a trial's reads leave its one overview on us", async () => {
  const testApp = await appServing({ status: "page", url: URL_OF_PAGE, html: HTML });
  const device = await makeTrialDevice(testApp);
  for (let n = 0; n < TRIAL_READS; n += 1) await device.readArticle(URL_OF_PAGE);

  const made = await device.generate();

  assert.equal(made.statusCode, 200);
  await testApp.close();
});

test("new tokens from one address read no more that day, while another address does", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await appServing({ status: "failed", reason: "blocked" }, logger);
  for (let spent = 0; spent < TRIAL_READS_PER_ADDRESS_DAILY; spent += TRIAL_READS) {
    const device = await makeTrialDevice(testApp);
    for (let n = 0; n < TRIAL_READS; n += 1) await device.readArticle(URL_OF_PAGE);
  }

  const privateWindow = await makeTrialDevice(testApp);
  const refused = await privateWindow.readArticle(URL_OF_PAGE);
  const elsewhere = await (await makeTrialDevice(testApp, "198.51.100.4")).readArticle(URL_OF_PAGE);
  testApp.clock.advance(DAY_MS);
  const tomorrow = await privateWindow.readArticle(URL_OF_PAGE);

  assert.equal(refused.statusCode, 429);
  assert.equal(refused.json().error.details.quota, "trial-reads-address");
  assert.ok(Number(refused.headers["retry-after"]) > 0);
  assert.equal(elsewhere.statusCode, 200);
  assert.equal(tomorrow.statusCode, 200);
  assert.equal(saying(lines, "trial read address cap spent").length, 1);
  assert.ok(!JSON.stringify(lines).includes("203.0.113.7"));
  await testApp.close();
});

test("a token this server never issued is told so, so the device asks for another", async () => {
  const testApp = await appServing({ status: "failed", reason: "blocked" });

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/articles/read",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION), [TRIAL_TOKEN_HEADER]: "made-up" },
    payload: { url: URL_OF_PAGE },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.details.trial, "unknown");
  await testApp.close();
});
