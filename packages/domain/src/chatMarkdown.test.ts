import test from "node:test";
import assert from "node:assert/strict";
import { chatMarkdown } from "./chatMarkdown.js";
import type { Chat, ChatCitation } from "./Chat.js";
import { makeArticleOverview, makeOverview, makeRecipeOverview } from "./OverviewFactory.testHelper.js";
import { overviewPartHash } from "./overviewParts.js";

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

const answeredWith = (overviewId: Chat["overviewId"], citations: ChatCitation[], inSource: boolean): Chat => ({
  id: `${overviewId}:c1`,
  overviewId,
  startedAt: AT,
  messages: [
    { from: "reader", text: "What first?", at: AT },
    { from: "answer", text: "Step 2.", at: AT, citations, inSource },
  ],
});

test("an answer from the overview names the part it cites and says it isn't the video's own words", () => {
  const overview = makeOverview({ howToApply: { items: ["Start small", "Keep going"] } });
  const markdown = chatMarkdown(
    answeredWith(overview.id, [{ part: "howToApply", index: 1, textHash: overviewPartHash("Keep going") }], false),
    overview,
  );
  assert.match(markdown, /Cites: item 2 of the overview's "How to apply"\./);
  assert.match(markdown, /Answered from the overview, not from what the video says\./);
  assert.doesNotMatch(markdown, /doesn't cover this/);
});

test("a cited item the overview has since rewritten points at its section", () => {
  const overview = makeOverview({ howToApply: { items: ["Something new"] } });
  const markdown = chatMarkdown(
    answeredWith(overview.id, [{ part: "howToApply", index: 1, textHash: overviewPartHash("Keep going") }], false),
    overview,
  );
  assert.match(markdown, /the overview's "How to apply", an item since changed/);
});

test("an article is answered from its overview alone: a cited chapter reads as one, and only a decline is noted", () => {
  const article = makeArticleOverview();
  const cited = chatMarkdown(
    answeredWith(article.id, [{ part: "chapter", index: 1, textHash: overviewPartHash("Who pays") }], false),
    article,
  );
  assert.match(cited, /from the overview of this article, not from the page itself/);
  assert.match(cited, /Cites: item 2 of the overview's "Chapters"\./);
  assert.doesNotMatch(cited, /Answered from the overview|doesn't cover this/);
  const readAnyway = chatMarkdown(
    answeredWith(article.id, [{ part: "watchAnyway", index: 0, textHash: overviewPartHash("Nothing here needs the page.") }], false),
    article,
  );
  assert.match(readAnyway, /Cites: the overview's "Read it anyway\?"\./);
  const declined = chatMarkdown(answeredWith(article.id, [], false), article);
  assert.match(declined, /The overview of this article doesn't cover this/);
});

test("a recipe page's decline says the recipe doesn't cover it", () => {
  const recipe = makeRecipeOverview();
  assert.match(chatMarkdown(answeredWith(recipe.id, [], false), recipe), /The recipe doesn't cover this/);
});
