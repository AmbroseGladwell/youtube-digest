import { describe, expect, it } from "vitest";
import {
  podcastSourceId,
  sourceKey,
  type ClientWarningReport,
  type FeedRead,
  type KeptCapture,
  type OverviewStore,
} from "@overview/domain";
import { SyncRequestError, type FeedApi } from "@overview/sync";
import { InMemoryCaptureStore } from "../../captures/types/InMemoryCaptureStore.testHelper.js";
import { FEED_URL, makeFeedEntry, makeFeedSnapshot, makeFollowedFeed } from "../types/FeedFactory.testHelper.js";
import { InMemoryFollowedFeedStore } from "../types/InMemoryFollowedFeedStore.testHelper.js";
import { checkFollowedFeeds } from "./checkFollowedFeeds.js";

const NOW = new Date("2026-11-28T09:00:00.000Z");
const day = (n: number) => `2026-11-${String(n).padStart(2, "0")}T09:00:00.000Z`;

const setUp = (read: FeedRead | Error, held: string[] = []) => {
  const followedFeedStore = new InMemoryFollowedFeedStore();
  const captureStore = new InMemoryCaptureStore();
  const warnings: ClientWarningReport[] = [];
  const asked: string[][] = [];
  const api: FeedApi = {
    lookUp: async () => {
      throw new Error("not asked");
    },
    check: async (feedUrls) => {
      asked.push([...feedUrls]);
      if (read instanceof Error) {
        throw read;
      }
      return { feeds: [{ feedUrl: FEED_URL, read }] };
    },
  };
  const overviewStore = {
    listOverviews: async () => held.map((id) => ({ source: { kind: "youtube", id } })),
    listUnreadable: async () => [],
  } as unknown as OverviewStore;
  let ids = 0;
  const deps = {
    api,
    followedFeedStore,
    captureStore,
    overviewStore,
    now: () => NOW,
    newId: () => `00000000-0000-4000-8000-${String(ids++).padStart(12, "0")}`,
    warn: (warning: ClientWarningReport) => warnings.push(warning),
  };
  const kept = async () => (await captureStore.listCaptures()) as KeptCapture[];
  return { deps, followedFeedStore, captureStore, warnings, asked, kept };
};

describe("checking followed feeds on opening", () => {
  it("asks once for every feed, and new entries wait for the reader, marked with where they came from", async () => {
    const feed = makeFollowedFeed({ followedAt: day(20) });
    const { deps, followedFeedStore, kept, asked } = setUp({
      status: "read",
      feed: makeFeedSnapshot([makeFeedEntry("ep-2", day(27)), makeFeedEntry("ep-1", day(10))]),
    });

    const outcome = await checkFollowedFeeds([feed], deps);

    expect(asked).toEqual([[FEED_URL]]);
    expect(outcome).toEqual({ arrived: 1, dropped: 0 });
    const [capture] = await kept();
    expect(capture).toMatchObject({
      keptFrom: "feed",
      waitingFor: "turn",
      queueStatus: "waiting",
      fromFeed: { id: feed.id, kind: "podcast", title: "The History Show" },
      sourceKey: sourceKey({ kind: "podcast", id: await podcastSourceId({ feedUrl: FEED_URL, guid: "ep-2" }) }),
      addedAt: day(27),
      source: { kind: "podcast", feedUrl: FEED_URL, guid: "ep-2", showName: "The History Show", durationMs: 3_600_000 },
    });
    expect((await followedFeedStore.getCheck(feed.id))?.seenEntryIds).toEqual(["ep-2", "ep-1"]);
  });

  it("brings nothing twice: a second check after the first finds nothing new", async () => {
    const feed = makeFollowedFeed({ followedAt: day(20) });
    const { deps, kept } = setUp({ status: "read", feed: makeFeedSnapshot([makeFeedEntry("ep-2", day(27))]) });

    await checkFollowedFeeds([feed], deps);
    const again = await checkFollowedFeeds([feed], deps);

    expect(again.arrived).toBe(0);
    expect(await kept()).toHaveLength(1);
  });

  it("leaves out a video already in the library", async () => {
    const feed = makeFollowedFeed({ kind: "youTubeChannel", followedAt: day(20) });
    const video = makeFeedEntry("yt:video:dQw4w9WgXcQ", day(27), { kind: "video", youTubeVideoId: "dQw4w9WgXcQ", audioUrl: null });
    const { deps, kept } = setUp({ status: "read", feed: makeFeedSnapshot([video], { kind: "youTubeChannel" }) }, ["dQw4w9WgXcQ"]);

    await checkFollowedFeeds([feed], deps);

    expect(await kept()).toEqual([]);
  });

  it("holds a source to its newest 20, and says how many dropped", async () => {
    const feed = makeFollowedFeed({ followedAt: "2026-10-01T09:00:00.000Z" });
    const entries = Array.from({ length: 25 }, (_, index) =>
      makeFeedEntry(`ep-${index}`, new Date(Date.UTC(2026, 10, 25 - index)).toISOString()),
    );
    const { deps, kept, warnings } = setUp({ status: "read", feed: makeFeedSnapshot(entries) });

    const outcome = await checkFollowedFeeds([feed], deps);

    expect(outcome).toEqual({ arrived: 20, dropped: 5 });
    expect((await kept()).map(({ title }) => title)).not.toContain("Episode ep-24");
    expect(warnings).toEqual([{ name: "feedEntriesDropped", dropped: 5 }]);
  });

  it("marks a feed gone when our copy says so, and readable again when it comes back, with what it now says", async () => {
    const feed = makeFollowedFeed();
    const gone = setUp({ status: "read", feed: makeFeedSnapshot([], { freshness: "gone" }) });
    await checkFollowedFeeds([feed], gone.deps);
    const back = setUp({ status: "read", feed: makeFeedSnapshot([], { title: "The History Show, renamed" }) });
    await checkFollowedFeeds([{ ...feed, unavailable: "gone" }], back.deps);

    expect((await gone.followedFeedStore.listFollowed())[0]?.unavailable).toBe("gone");
    expect(await back.followedFeedStore.listFollowed()).toMatchObject([{ unavailable: null, title: "The History Show, renamed" }]);
  });

  it("warns and carries on when a feed or the whole check fails, and writes nothing", async () => {
    const busy = setUp({ status: "failed", reason: "busy" });
    await checkFollowedFeeds([makeFollowedFeed()], busy.deps);
    const refused = setUp(new SyncRequestError("too_many_requests", 429, "slow down"));
    await checkFollowedFeeds([makeFollowedFeed()], refused.deps);

    expect(busy.warnings).toEqual([{ name: "feedCheckFailed", outcome: "busy" }]);
    expect(refused.warnings).toEqual([{ name: "feedCheckFailed", outcome: "failed", apiErrorCode: "too_many_requests" }]);
    expect([...(await busy.kept()), ...(await refused.kept())]).toEqual([]);
  });

  it("asks for nothing when no feed is followed", async () => {
    const { deps, asked } = setUp({ status: "failed", reason: "busy" });
    expect(await checkFollowedFeeds([], deps)).toEqual({ arrived: 0, dropped: 0 });
    expect(asked).toEqual([]);
  });
});
