import test from "node:test";
import assert from "node:assert/strict";
import { OverviewId, SourceKey } from "./Brands.js";
import { OurKeyGenerationRequest } from "./OurKeyGenerationRequest.js";
import type { PodcastSource, SocialSource, TikTokSource } from "./Source.js";
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

const tiktok: TikTokSource = {
  kind: "tiktok",
  id: SourceKey.parse("7301234567890123456"),
  url: "https://www.tiktok.com/@kitchenwithada/video/7301234567890123456",
  title: "The one-pan jollof",
  handle: "kitchenwithada",
  authorName: "Kitchen with Ada",
  durationMs: 42_000,
  publishedAt: null,
  imageUrl: null,
};

test("a TikTok sent to be made on our key arrives as a TikTok, with the kind already checked", () => {
  const request = OurKeyGenerationRequest.parse({
    overviewId: OverviewId.parse("00000000-0000-4000-8000-000000000001"),
    input: {
      tiktok,
      video: {
        id: null,
        url: tiktok.url,
        title: tiktok.title,
        channel: tiktok.authorName,
        description: null,
        durationMs: tiktok.durationMs,
        publishedAt: null,
        thumbnailUrl: null,
      },
      transcript: [{ text: "Hello.", startMs: 0, endMs: 1000 }],
      noteKind: "recipe",
      captureReason: null,
      readerContext: null,
      sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
      existingTopics: [],
      pastClaims: [],
      existingTags: [],
      tagAliases: {},
    },
  });
  assert.ok("tiktok" in request.input);
  assert.deepEqual(request.input.tiktok, tiktok);
  assert.equal(request.input.noteKind, "recipe");
});

const reel: SocialSource = {
  kind: "instagram",
  id: SourceKey.parse("DAbCdEfGh12"),
  url: "https://www.instagram.com/reel/DAbCdEfGh12/",
  title: "Five ways to keep basil alive",
  handle: "windowsillgarden",
  authorName: "Windowsill Garden",
  media: "video",
  wordCount: 120,
  durationMs: 59_000,
  publishedAt: null,
  imageUrl: null,
};

test("an Instagram reel sent to be made on our key arrives as the reel, its whole long description kept", () => {
  const fullDescription = "Water from below, never over the leaves. ".repeat(300).trim();
  const request = OurKeyGenerationRequest.parse({
    overviewId: OverviewId.parse("00000000-0000-4000-8000-000000000001"),
    input: {
      social: reel,
      video: {
        id: null,
        url: reel.url,
        title: reel.title,
        channel: reel.authorName,
        description: fullDescription.slice(0, 400),
        fullDescription,
        durationMs: reel.durationMs,
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
  assert.ok("social" in request.input && "video" in request.input);
  assert.deepEqual(request.input.social, reel);
  assert.equal(request.input.video.fullDescription, fullDescription);
});

test("a photo post sent to be made on our key arrives as the post with its description as the article", () => {
  const photo: SocialSource = { ...reel, media: "photo", durationMs: null };
  const request = OurKeyGenerationRequest.parse({
    overviewId: OverviewId.parse("00000000-0000-4000-8000-000000000001"),
    input: {
      social: photo,
      article: {
        url: photo.url,
        title: photo.title,
        siteName: "Instagram",
        author: photo.authorName,
        publishedAt: null,
        language: null,
        imageUrl: null,
        sections: [{ heading: null, anchor: null, text: "Water from below.", links: [] }],
        wordCount: 3,
        recipe: null,
      },
      captureReason: null,
      readerContext: null,
      sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
      existingTopics: [],
      pastClaims: [],
      existingTags: [],
      tagAliases: {},
    },
  });
  assert.ok("social" in request.input && "article" in request.input);
  assert.deepEqual(request.input.social, photo);
});
