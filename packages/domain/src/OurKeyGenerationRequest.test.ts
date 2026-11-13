import test from "node:test";
import assert from "node:assert/strict";
import { OverviewId, SourceKey } from "./Brands.js";
import { OurKeyGenerationRequest } from "./OurKeyGenerationRequest.js";
import type { PodcastSource } from "./Source.js";
import { DEFAULT_SECTIONS_ENABLED } from "./Settings.js";

const podcast: PodcastSource = {
  kind: "podcast",
  id: SourceKey.parse("fedcba9876543210fedcba9876543210"),
  feedUrl: "https://feeds.example/diary.xml",
  guid: "episode-guid",
  title: "Why your parents’ decline is a preview",
  showName: "The Diary Of A CEO",
  publishedAt: null,
  durationMs: 6_948_000,
  audioUrl: "https://media.example/episode.mp3",
  pageUrl: null,
  imageUrl: null,
  sharedFrom: "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk",
};

test("an episode sent to be made on our key arrives as an episode, not stripped to the video it also carries", () => {
  const request = OurKeyGenerationRequest.parse({
    overviewId: OverviewId.parse("00000000-0000-4000-8000-000000000001"),
    input: {
      podcast,
      video: {
        id: null,
        url: podcast.audioUrl,
        title: podcast.title,
        channel: podcast.showName,
        description: null,
        durationMs: podcast.durationMs,
        publishedAt: null,
        thumbnailUrl: null,
      },
      transcript: [{ text: "Hello.", startMs: 0, endMs: 1000 }],
      captureReason: null,
      readerContext: null,
      sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
      existingTopics: [],
      pastClaims: [],
      existingTags: [],
      tagAliases: {},
    },
  });
  assert.ok("podcast" in request.input);
  assert.deepEqual(request.input.podcast, podcast);
});
