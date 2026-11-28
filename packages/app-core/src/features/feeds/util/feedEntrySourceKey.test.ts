import { describe, expect, it } from "vitest";
import { articleSourceId, podcastSourceId } from "@overview/domain";
import { FEED_URL, makeFeedEntry } from "../types/FeedFactory.testHelper.js";
import { feedEntrySourceKey } from "./feedEntrySourceKey.js";
import { feedEntryUrl } from "./feedEntryUrl.js";

describe("an entry's key and link are the ones its overview will have", () => {
  it("names an episode by its feed and guid, so a podcast overview of it is the same source", async () => {
    const entry = makeFeedEntry("ep-1", null);
    expect(await feedEntrySourceKey(FEED_URL, entry)).toBe(`podcast:${await podcastSourceId({ feedUrl: FEED_URL, guid: "ep-1" })}`);
    expect(feedEntryUrl(entry)).toBe("https://show.example/ep-1");
    expect(feedEntryUrl({ ...entry, pageUrl: null })).toBe("https://cdn.show.example/ep-1.mp3");
  });

  it("names a video by its bare id, and gives its watch link", async () => {
    const entry = makeFeedEntry("yt:video:dQw4w9WgXcQ", null, { kind: "video", youTubeVideoId: "dQw4w9WgXcQ", audioUrl: null });
    expect(await feedEntrySourceKey(FEED_URL, entry)).toBe("dQw4w9WgXcQ");
    expect(feedEntryUrl(entry)).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("names a post by its page, and a post with no page has neither", async () => {
    const post = makeFeedEntry("post-1", null, { kind: "article", audioUrl: null });
    expect(await feedEntrySourceKey(FEED_URL, post)).toBe(`web:${await articleSourceId("https://show.example/post-1")}`);
    expect(await feedEntrySourceKey(FEED_URL, { ...post, pageUrl: null })).toBeNull();
    expect(feedEntryUrl({ ...post, pageUrl: null })).toBeNull();
  });
});
