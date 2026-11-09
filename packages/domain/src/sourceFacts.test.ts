import test from "node:test";
import assert from "node:assert/strict";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { articleSourceId, type WebSource } from "./Source.js";
import { articleReadMinutes, sourceImage, sourceLength, sourceName } from "./sourceFacts.js";

const article: WebSource = {
  kind: "web",
  id: "abc" as WebSource["id"],
  url: "https://www.harbour.example/a",
  title: "A",
  siteName: "The Harbour Post",
  author: null,
  publishedAt: null,
  language: null,
  imageUrl: "https://cdn.example/a.jpg",
  wordCount: 3220,
};

test("a piece is from its channel, its site, or failing that its address", () => {
  assert.equal(sourceName(makeOverview().source), "Example Channel");
  assert.equal(sourceName(article), "The Harbour Post");
  assert.equal(sourceName({ ...article, siteName: null }), "harbour.example");
});

test("the length line names the kind", () => {
  assert.equal(sourceLength(article), "14 min article");
  assert.equal(sourceLength({ ...makeOverview().source, durationMs: 698_000 }), "11:38 video");
});

test("a video whose length is not known still says it is a video, and no length is guessed", () => {
  assert.equal(sourceLength(makeOverview().source), "Video");
});

test("reading time is 230 words a minute, and never zero", () => {
  assert.equal(articleReadMinutes(230), 1);
  assert.equal(articleReadMinutes(10), 1);
  assert.equal(articleReadMinutes(3220), 14);
});

test("the image is the page's share image", () => {
  assert.equal(sourceImage(article), "https://cdn.example/a.jpg");
  assert.equal(sourceImage({ ...article, imageUrl: null }), null);
});

test("an article's id is the same for the same address, short, and safe in a path", async () => {
  const id = await articleSourceId("https://a.example/post");
  assert.equal(id, await articleSourceId("https://a.example/post"));
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.notEqual(id, await articleSourceId("https://a.example/other"));
});
