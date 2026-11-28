import { describe, expect, it } from "vitest";
import { makeQueuedCapture } from "../../playlists/types/PlaylistFactory.testHelper.js";
import { queuedKindOf } from "./queuedKindOf.js";

describe("queuedKindOf", () => {
  it("makes a YouTube link as a video, an entry carrying an episode as an episode, and anything else as a post", () => {
    const episode = {
      kind: "podcast" as const,
      id: "0123456789abcdef0123456789abcdef" as never,
      feedUrl: "https://show.example/feed.xml",
      guid: "ep-1",
      title: "Episode 1",
      showName: "The History Show",
      publishedAt: null,
      durationMs: null,
      audioUrl: "https://cdn.show.example/ep-1.mp3",
      pageUrl: null,
      imageUrl: null,
      sharedFrom: "https://show.example/ep-1",
    };
    expect(queuedKindOf(makeQueuedCapture())).toBe("video");
    expect(queuedKindOf({ url: "https://show.example/ep-1", source: episode })).toBe("episode");
    expect(queuedKindOf({ url: "https://blog.example/post", source: null })).toBe("article");
  });
});
