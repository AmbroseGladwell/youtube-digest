import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, MOST_FEEDS_FOLLOWED, type FeedCheck, type FeedRead } from "@overview/domain";
import { makeFakeFeedWeb } from "../feeds/FakeFeedWeb.testHelper.js";
import { datedItem, rssOf } from "../feeds/feedFixtures.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";

const FEED = "https://letter.example/feed";

const appWithFeeds = async () => {
  const web = makeFakeFeedWeb();
  web.answers.set(FEED, { body: rssOf(datedItem(10, "Mon, 10 Nov 2026 09:00:00 GMT")) });
  web.answers.set("https://show.example/rss", {
    body: rssOf(`<item><title>E1</title><guid>e1</guid><enclosure url="https://show.example/e1.mp3" type="audio/mpeg"/></item>`),
  });
  const testApp = await createTestApp({}, { feedWeb: web.fetch });
  return { testApp, web };
};

test("only an account can look up or check a feed", async () => {
  const { testApp, web } = await appWithFeeds();

  const headers = { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) };
  const lookup = await testApp.app.inject({ method: "POST", url: "/api/feeds/lookup", headers, payload: { url: FEED } });
  const check = await testApp.app.inject({ method: "POST", url: "/api/feeds/check", headers, payload: { feedUrls: [FEED] } });

  assert.deepEqual([lookup.statusCode, check.statusCode], [401, 401]);
  assert.equal(web.calls.length, 0);
  await testApp.close();
});

test("a pasted feed link comes back as the feed to preview", async () => {
  const { testApp } = await appWithFeeds();
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/feeds/lookup", body: { url: FEED } });

  const read = response.json<FeedRead>();
  assert.equal(response.statusCode, 200);
  assert.equal(read.status, "read");
  assert.deepEqual(read.status === "read" ? [read.feed.kind, read.feed.entries.map((entry) => entry.id)] : null, ["blog", ["p10"]]);
  await testApp.close();
});

test("a check answers each feed once, in the order asked, each with its own kind or failure", async () => {
  const { testApp, web } = await appWithFeeds();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: "/api/feeds/check",
    body: { feedUrls: ["https://show.example/rss", FEED, "https://show.example/rss", "https://gone.example/feed"] },
  });

  const { feeds } = response.json<FeedCheck>();
  assert.deepEqual(
    feeds.map(({ feedUrl, read }) => [feedUrl, read.status === "read" ? read.feed.kind : read.reason]),
    [
      ["https://show.example/rss", "podcast"],
      [FEED, "blog"],
      ["https://gone.example/feed", "missing"],
    ],
  );
  assert.equal(web.calls.length, 3);
  await testApp.close();
});

test("a check holds at most as many feeds as can be followed", async () => {
  const { testApp } = await appWithFeeds();
  const account = await makeAccount(testApp);
  const feedUrls = Array.from({ length: MOST_FEEDS_FOLLOWED + 1 }, (_, index) => `https://many.example/${index}`);

  const response = await account.inject({ method: "POST", url: "/api/feeds/check", body: { feedUrls } });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});
