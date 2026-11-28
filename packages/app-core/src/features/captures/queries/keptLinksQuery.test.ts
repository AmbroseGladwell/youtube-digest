import { describe, expect, it } from "vitest";
import { OverviewId, VideoId, type KeptCapture } from "@overview/domain";
import { makeFollowedFeed } from "../../feeds/types/FeedFactory.testHelper.js";
import { InMemoryCaptureStore } from "../types/InMemoryCaptureStore.testHelper.js";
import { keptLinksQueryOptions } from "./keptLinksQuery.js";

const kept = (id: string, overrides: Partial<KeptCapture>): KeptCapture => ({
  id: OverviewId.parse(id),
  sourceKey: VideoId.parse(id.slice(-11)),
  url: `https://www.youtube.com/watch?v=${id.slice(-11)}`,
  keptAt: "2026-11-28T09:00:00.000Z",
  keptFrom: "web",
  captureReason: null,
  title: null,
  thumbnailUrl: null,
  fromPlaylist: null,
  addedAt: null,
  playlistIndex: null,
  chosenAt: null,
  stage: "kept",
  source: null,
  waitingFor: "server",
  resumesAt: null,
  queueStatus: "waiting",
  problem: null,
  ...overrides,
});

describe("kept links", () => {
  it("leave out a feed's entries, which wait for the reader and are never made by themselves", async () => {
    const store = new InMemoryCaptureStore();
    const feed = makeFollowedFeed();
    store.seedCapture(kept("00000000-0000-4000-8000-000000000001", {}));
    store.seedCapture(
      kept("00000000-0000-4000-8000-000000000002", {
        keptFrom: "feed",
        waitingFor: "turn",
        fromFeed: { id: feed.id, kind: feed.kind, title: feed.title },
      }),
    );

    const links = await keptLinksQueryOptions(store).queryFn!({} as never);

    expect(links.map(({ id }) => id)).toEqual(["00000000-0000-4000-8000-000000000001"]);
  });
});
