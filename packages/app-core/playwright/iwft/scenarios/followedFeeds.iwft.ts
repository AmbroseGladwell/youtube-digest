import { VideoId, type KeptCapture } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { FEED_URL, makeFeedEntry, makeFeedSnapshot, makeFollowedFeed } from "../../../src/features/feeds/types/FeedFactory.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const SIGNED_IN = {
  apiKeys: ANTHROPIC_KEY,
  sync: true,
  syncConnection: {
    apiUrl: "https://sync.test",
    token: null,
    accountId: SIMULATED_ACCOUNT_ID,
    email: SIMULATED_EMAIL,
    firstName: "Ada",
  },
} as const;

const feed = makeFollowedFeed({ followedAt: "2026-11-20T09:00:00.000Z" });
const episode = makeFeedEntry("ep-new", "2026-11-27T09:00:00.000Z");
const video = makeFeedEntry("yt:video:VIDEO000001", "2026-11-26T09:00:00.000Z", {
  kind: "video",
  youTubeVideoId: "VIDEO000001",
  audioUrl: null,
});
const before = makeFeedEntry("ep-old", "2026-11-10T09:00:00.000Z");

const fromFeed = async (list: () => Promise<unknown[]>) =>
  ((await list()) as KeptCapture[]).filter((capture) => capture.keptFrom === "feed");

test("on opening, a followed feed's new entries wait for the reader, and nothing is fetched or made for them", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.feeds.seedFollowed(feed);
  backendSimulator.feeds.seedRead(FEED_URL, { status: "read", feed: makeFeedSnapshot([episode, video, before]) });

  await launcher.launch(SIGNED_IN);

  await expect.poll(async () => (await fromFeed(backendSimulator.captureStore.list)).length).toBe(2);
  const waiting = await fromFeed(backendSimulator.captureStore.list);
  expect(
    waiting.map(({ title, waitingFor, queueStatus, fromFeed: origin }) => ({ title, waitingFor, queueStatus, feed: origin?.id })),
  ).toEqual(
    expect.arrayContaining([
      { title: episode.title, waitingFor: "turn", queueStatus: "waiting", feed: feed.id },
      { title: video.title, waitingFor: "turn", queueStatus: "waiting", feed: feed.id },
    ]),
  );
  expect((await backendSimulator.feeds.getCheck(feed.id))?.seenEntryIds).toEqual([episode.id, video.id, before.id]);
  expect(backendSimulator.getCallCount(EndpointKey.FEED_CHECK)).toBe(1);
  for (const endpoint of [
    EndpointKey.ANTHROPIC_MESSAGES,
    EndpointKey.OUR_KEY_GENERATE,
    EndpointKey.SERVICE_TRANSCRIPT,
    EndpointKey.INNERTUBE_PLAYER,
  ]) {
    expect(backendSimulator.getCallCount(endpoint), endpoint).toBe(0);
  }
});

test("an entry already in the library never arrives, and a feed our server says is gone is marked so", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview({ source: { ...makeOverview().source, id: VideoId.parse("VIDEO000001") } }));
  backendSimulator.feeds.seedFollowed(feed);
  backendSimulator.feeds.seedRead(FEED_URL, { status: "read", feed: makeFeedSnapshot([video], { freshness: "gone" }) });

  await launcher.launch(SIGNED_IN);

  await expect.poll(async () => (await backendSimulator.feeds.listFollowed())[0]?.unavailable).toBe("gone");
  expect(await fromFeed(backendSimulator.captureStore.list)).toEqual([]);
});
