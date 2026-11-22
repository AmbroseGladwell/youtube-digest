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

test("an answer citing another overview names it by title and says it came from the reader's other overviews", () => {
  const overview = makeOverview();
  const other = makeOverview();
  const markdown = chatMarkdown(
    answeredWith(
      overview.id,
      [
        { overviewId: other.id, title: "Eat more plants", item: { part: "keyPoint", index: 1, textHash: overviewPartHash("x") } },
        { overviewId: other.id, title: "Eat more plants", item: null },
      ],
      false,
    ),
    overview,
  );
  assert.match(
    markdown,
    new RegExp(
      `Cites: item 2 of "Key points" in the reader's overview "Eat more plants" \\(${other.id}\\); the reader's overview "Eat more plants"`,
    ),
  );
  assert.match(markdown, /Answered from the reader's other overviews, not from what the video says\./);
  assert.doesNotMatch(markdown, /doesn't cover this/);
});

test("a minute of another overview's source is named by its times (OV-352)", () => {
  const overview = makeOverview();
  const other = makeOverview();
  const markdown = chatMarkdown(
    answeredWith(
      overview.id,
      [{ overviewId: other.id, title: "Eat more plants", item: null, range: { startMs: 201_000, endMs: 260_000 } }],
      false,
    ),
    overview,
  );
  assert.match(markdown, /Cites: 3:21–4:20 of the reader's overview "Eat more plants"/);
});

const CODE_ITEM = 'Ban explicit any:\n```js\nrules: {\n  "no-explicit-any": "error",\n}\n```\nThis flags `value: any`.';

test("code inside a section's list item, paragraph or a plain answer stays inside it, indented to its place (OV-374)", () => {
  const cited = { overviewId: "o1", title: "Typed code", item: null } as ChatCitation;
  const chat: Chat = {
    id: "library:c1",
    startedAt: AT,
    messages: [
      { from: "reader", text: "How do I stop any?", at: AT },
      {
        from: "answer",
        text: "Two rules.",
        at: AT,
        citations: [cited],
        inSource: false,
        sections: {
          intro: "Two rules.",
          introSources: [],
          sections: [
            {
              heading: "Lint",
              paragraphs: ["Turn it on:\n```sh\nnpx oxlint\n```"],
              numbered: [{ text: CODE_ITEM, sources: [cited] }],
              bullets: [
                { text: "Also:\n```ts\nconst a: unknown = 1;\n```", sources: [] },
                { text: "Then relax.", sources: [] },
              ],
              sources: [],
            },
          ],
          takeaway: "Pick one.",
        },
      },
      { from: "reader", text: "And plainly?", at: AT },
      { from: "answer", text: "Like so:\n```\nnpm i\n```\nDone.", at: AT, citations: [], inSource: true },
    ],
  };

  const read = chatMarkdown(chat, { kind: "library" });

  assert.ok(
    read.includes(
      [
        "2. **The answer** (2026-11-15): Two rules.",
        "   1. Lint",
        "      Turn it on:",
        "      ```sh",
        "      npx oxlint",
        "      ```",
        "      1) Ban explicit any:",
        "         ```js",
        "         rules: {",
        '           "no-explicit-any": "error",',
        "         }",
        "         ```",
        '         This flags `value: any`. (the reader\'s overview "Typed code" (o1))',
        "      - Also:",
        "        ```ts",
        "        const a: unknown = 1;",
        "        ```",
        "      - Then relax.",
        "",
        "   Pick one.",
        "3. **The reader asked** (2026-11-15): And plainly?",
        "4. **The answer** (2026-11-15): Like so:",
        "   ```",
        "   npm i",
        "   ```",
        "   Done.",
      ].join("\n"),
    ),
    read,
  );
});

test("an item's sources follow its code on a line of their own, so the fence still closes (OV-374)", () => {
  const cited = { overviewId: "o1", title: "Typed code", item: null } as ChatCitation;
  const chat: Chat = {
    id: "library:c1",
    startedAt: AT,
    messages: [
      {
        from: "answer",
        text: "One.",
        at: AT,
        citations: [cited],
        inSource: false,
        sections: {
          intro: "One.",
          introSources: [],
          sections: [
            {
              heading: "Lint",
              paragraphs: [],
              numbered: [],
              bullets: [{ text: "Run:\n```sh\nnpx oxlint\n```", sources: [cited] }],
              sources: [],
            },
          ],
          takeaway: "",
        },
      },
    ],
  };

  assert.ok(
    chatMarkdown(chat, { kind: "library" }).endsWith(
      ["      - Run:", "        ```sh", "        npx oxlint", "        ```", '        (the reader\'s overview "Typed code" (o1))'].join(
        "\n",
      ),
    ),
  );
});

test("an answer's notes stay inside its item from the tenth message on (OV-374)", () => {
  const overview = makeOverview();
  const messages: Chat["messages"] = Array.from({ length: 10 }, (_, at) =>
    at % 2 === 0
      ? { from: "reader" as const, text: `Question ${at}?`, at: AT }
      : { from: "answer" as const, text: "An answer.", at: AT, citations: [{ startMs: 1_000, endMs: 2_000 }], inSource: true },
  );

  const read = chatMarkdown({ id: `${overview.id}:c1`, overviewId: overview.id, startedAt: AT, messages }, overview);

  assert.match(read, /10\. \*\*The answer\*\* \(2026-11-15\): An answer\.\n {4}Cites: /);
});
