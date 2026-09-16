import test from "node:test";
import assert from "node:assert/strict";
import type { Metadata } from "@supadata/js";
import { mapMetadataToVideoSource } from "./mapMetadataToVideoSource.js";

const baseMetadata: Metadata = {
  platform: "youtube",
  type: "video",
  id: "tL9Lw250spc",
  url: "https://youtube.com/watch?v=tL9Lw250spc",
  title: "Why does every mammal get 1 billion heartbeats in their life?",
  description: "The hidden math that governs life.",
  author: { username: "veritasium", displayName: "Veritasium", avatarUrl: "", verified: true },
  stats: { views: 1, likes: 1, comments: 1, shares: null },
  media: { type: "video", url: "", duration: 2127.2, width: 1920, height: 1080, thumbnailUrl: "" },
  tags: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  additionalData: {},
};

test("channel comes from author.displayName, duration is converted from seconds to milliseconds", () => {
  const video = mapMetadataToVideoSource(baseMetadata, baseMetadata.url);
  assert.equal(video.channel, "Veritasium");
  assert.equal(video.durationMs, 2127200);
});

test("a null title or description degrades to the documented fallback, not a crash", () => {
  const video = mapMetadataToVideoSource({ ...baseMetadata, title: null, description: null }, baseMetadata.url);
  assert.equal(video.title, "unavailable");
  assert.equal(video.description, null);
});

test("description is trimmed to VideoSource's 400-character cap", () => {
  const longDescription = "x".repeat(1000);
  const video = mapMetadataToVideoSource({ ...baseMetadata, description: longDescription }, baseMetadata.url);
  assert.equal(video.description?.length, 400);
});

test("non-video media (an image or carousel post) has no duration to report", () => {
  const video = mapMetadataToVideoSource(
    { ...baseMetadata, media: { type: "image", url: "", width: 1, height: 1 } },
    baseMetadata.url,
  );
  assert.equal(video.durationMs, null);
});
