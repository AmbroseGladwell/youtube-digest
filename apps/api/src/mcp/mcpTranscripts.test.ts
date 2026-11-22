import test from "node:test";
import assert from "node:assert/strict";
import {
  formatTimestamp,
  SourceKey,
  transcriptBlocks,
  VideoId,
  youtubeTimestampUrl,
  type TranscriptSegment,
  type WebSource,
} from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { sampleLibrary, type SampleLibrary } from "../testing/sampleLibrary.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { connectMcpClient, seedLibrary, type McpClient } from "./McpClient.testHelper.js";
import { NOT_SEARCHED_NOTE } from "./searchTranscripts.js";
import { TRANSCRIPT_PAGE_CHARS } from "./transcriptPage.js";

interface Connected {
  testApp: TestApp;
  reader: TestAccount;
  library: SampleLibrary;
  client: McpClient;
}

const connected = async (): Promise<Connected> => {
  const testApp = await createTestApp();
  const reader = await makeAccount(testApp);
  const library = sampleLibrary();
  await seedLibrary(reader, library);
  return { testApp, reader, library, client: await connectMcpClient(testApp, reader) };
};

const note = (library: SampleLibrary, topic: string) => library.notes.find((sample) => sample.topic === topic)!.overview;

const keep = async (reader: TestAccount, videoId: string, segments: TranscriptSegment[]) => {
  const response = await reader.inject({
    method: "PUT",
    url: `/api/transcripts/${videoId}`,
    body: makeStoredTranscript({ videoId: VideoId.parse(videoId), segments }),
  });
  assert.equal(response.statusCode, 204);
};

const ARTICLE: WebSource = {
  kind: "web",
  id: SourceKey.parse("fedcba9876543210fedcba9876543210"),
  url: "https://news.example.com/bridge",
  title: "Bridge repairs",
  siteName: "Example News",
  author: null,
  publishedAt: null,
  language: "en",
  imageUrl: null,
  wordCount: 2300,
};

const SENTENCE = "We kept on talking about training volume and how much rest a set needs between efforts.";
const TWO_HOURS_TEN = Array.from({ length: 130 * 3 }, (_, index) => ({
  text: index === 300 ? "Then the coach named Zatsiorsky as the source of it." : SENTENCE,
  startMs: index * 20_000,
  endMs: index * 20_000 + 18_000,
}));

test("search_transcripts finds a name only the transcript says, linked to its moment with the word in bold", async (t) => {
  const { testApp, reader, library, client } = await connected();
  t.after(() => testApp.close());
  const fitness = note(library, "fitness");
  await keep(reader, fitness.source.id!, [
    { text: "Add a set before you add weight.", startMs: 0, endMs: 3000 },
    { text: "Zatsiorsky wrote the book on it.", startMs: 65_000, endMs: 68_000 },
  ]);

  const { text, isError } = await client.callTool("search_transcripts", { query: "zatsiorsky" });

  assert.equal(isError, false);
  assert.match(text, /^1 saved overview\(s\) say it, most first\./);
  assert.ok(text.includes(`- **${fitness.source.title}**`));
  assert.ok(text.includes(`id ${fitness.id}`));
  assert.ok(text.includes(`[1:05](${youtubeTimestampUrl(fitness.source.url, 65_000)}): "**Zatsiorsky** wrote the book on it."`), text);
  assert.ok(text.endsWith(NOT_SEARCHED_NOTE));
});

test("search_transcripts says plainly when nothing said matches, and keeps to one overview when given its id", async (t) => {
  const { testApp, reader, library, client } = await connected();
  t.after(() => testApp.close());
  const [fitness, finance] = [note(library, "fitness"), note(library, "finance")];
  await keep(reader, fitness.source.id!, [{ text: "Compound interest, then compound lifts.", startMs: 0, endMs: 3000 }]);
  await keep(reader, finance.source.id!, [{ text: "Compound interest is the eighth wonder.", startMs: 0, endMs: 3000 }]);

  const nothing = await client.callTool("search_transcripts", { query: "quantum chromodynamics" });
  const one = await client.callTool("search_transcripts", { query: "compound interest", id: finance.id });

  assert.match(nothing.text, /^Nothing in the reader's transcripts says that\./);
  assert.match(one.text, /^1 saved overview\(s\) say it/);
  assert.ok(one.text.includes(`id ${finance.id}`));
  assert.ok(!one.text.includes(NOT_SEARCHED_NOTE));
});

test("search_transcripts refuses an article's id, which keeps no transcript", async (t) => {
  const { testApp, reader, client } = await connected();
  t.after(() => testApp.close());
  const article = storedOverview({ source: ARTICLE });
  await reader.inject({ method: "POST", url: "/api/overviews", body: article });

  const result = await client.callTool("search_transcripts", { query: "bridge", id: article.id });

  assert.equal(result.isError, true);
  assert.match(result.text, /Articles and recipes keep no transcript/);
});

test("get_transcript reads a source over two hours in parts that fit, each saying where it runs and how to carry on", async (t) => {
  const { testApp, reader, library, client } = await connected();
  t.after(() => testApp.close());
  const fitness = note(library, "fitness");
  await keep(reader, fitness.source.id!, TWO_HOURS_TEN);

  const parts: string[] = [];
  let cursor: string | undefined;
  do {
    const { text, isError } = await client.callTool("get_transcript", { id: fitness.id, ...(cursor === undefined ? {} : { cursor }) });
    assert.equal(isError, false);
    assert.ok(text.length < TRANSCRIPT_PAGE_CHARS + 2_000, `a part of ${text.length} characters`);
    parts.push(text);
    cursor = /call again with cursor "(\d+)"/.exec(text)?.[1];
  } while (cursor !== undefined && parts.length < 20);

  assert.ok(parts.length > 1);
  assert.match(parts[0]!, /This part runs 0:00–[\d:]+ of 2:09:58\./);
  assert.match(parts.at(-1)!, /This part runs \d+:\d+:\d+–2:09:58 of 2:09:58\.$/);
  const paragraphs = parts.flatMap((part) => [...part.matchAll(/^(\d+:\d+(?::\d+)?)\t/gm)].map((match) => match[1]));
  assert.equal(new Set(paragraphs).size, paragraphs.length, "no paragraph is read twice");
  assert.deepEqual(
    paragraphs,
    transcriptBlocks(TWO_HOURS_TEN).map((block) => formatTimestamp(block.startMs)),
  );
});

test("get_transcript reads from a time, where search_transcripts found the moment", async (t) => {
  const { testApp, reader, library, client } = await connected();
  t.after(() => testApp.close());
  const fitness = note(library, "fitness");
  await keep(reader, fitness.source.id!, TWO_HOURS_TEN);

  const found = await client.callTool("search_transcripts", { query: "Zatsiorsky", id: fitness.id });
  const moment = /\[(\d+:\d+:\d+)\]/.exec(found.text)?.[1];
  const { text } = await client.callTool("get_transcript", { id: fitness.id, from: moment });

  assert.equal(moment, "1:40:00");
  assert.match(text, /\n1:40:00\tThen the coach named Zatsiorsky/);
  assert.match(text, /This part runs 1:40:00–/);
});

test("get_transcript refuses a time past the end, and a time with a cursor", async (t) => {
  const { testApp, reader, library, client } = await connected();
  t.after(() => testApp.close());
  const fitness = note(library, "fitness");
  await keep(reader, fitness.source.id!, [{ text: "Add a set before you add weight.", startMs: 0, endMs: 3000 }]);

  const past = await client.callTool("get_transcript", { id: fitness.id, from: "10:00" });
  const both = await client.callTool("get_transcript", { id: fitness.id, from: "0:00", cursor: "1" });

  assert.equal(past.isError, true);
  assert.match(past.text, /Nothing is said after 0:03/);
  assert.equal(both.isError, true);
});
