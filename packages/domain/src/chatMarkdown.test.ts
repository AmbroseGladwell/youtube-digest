import test from "node:test";
import assert from "node:assert/strict";
import { chatMarkdown } from "./chatMarkdown.js";
import type { Chat } from "./Chat.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";

const AT = "2026-11-15T10:00:00.000Z";
const chatAbout = (overviewId: Chat["overviewId"]): Chat => ({
  id: `${overviewId}:c1`,
  overviewId,
  startedAt: AT,
  messages: [
    { from: "reader", text: "How much?", at: AT },
    { from: "answer", text: "Three grams.", at: AT, citations: [{ startMs: 61_000, endMs: 70_000 }], inSource: true },
  ],
});

test("an episode's cited times are plain text, never a link into its audio", () => {
  const overview = makeOverview();
  const episode = {
    ...overview,
    source: {
      kind: "podcast" as const,
      id: overview.source.id!,
      feedUrl: "https://feeds.example/show.xml",
      guid: "episode-guid",
      title: "An episode",
      showName: "A show",
      publishedAt: null,
      durationMs: 3_600_000,
      audioUrl: "https://media.example/episode.mp3",
      pageUrl: null,
      imageUrl: null,
      sharedFrom: "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk",
    },
  };

  const markdown = chatMarkdown(chatAbout(episode.id), episode);

  assert.match(markdown, /Cites: 1:01–1:10\./);
  assert.doesNotMatch(markdown, /media\.example|&t=|\?t=/);
});

test("a video's cited times link to their moment", () => {
  const overview = makeOverview();
  assert.match(chatMarkdown(chatAbout(overview.id), overview), /Cites: \[1:01–1:10\]\(https:\/\/.+[?&]t=61\)\./);
});
