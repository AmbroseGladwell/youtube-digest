import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CURRENT_SCHEMA_VERSIONS, OverviewId, TopicId, VideoId } from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { sampleLibrary, type SampleLibrary } from "../testing/sampleLibrary.testHelper.js";
import { storedOverview, storedTopic } from "../testing/storedRecords.testHelper.js";
import type { TestAccount } from "../testing/TestAccount.testHelper.js";
import { connectMcpClient, plusAccount, seedLibrary, type McpClient } from "./McpClient.testHelper.js";
import { LISTING_PAGE_SIZE, OVERVIEWS_PER_CALL } from "./mcpTools.js";

interface Connected {
  testApp: TestApp;
  reader: TestAccount;
  library: SampleLibrary;
  client: McpClient;
}

async function connectedToSamples(): Promise<Connected> {
  const testApp = await createTestApp();
  const reader = await plusAccount(testApp);
  const library = sampleLibrary();
  await seedLibrary(reader, library);
  return { testApp, reader, library, client: await connectMcpClient(testApp, reader) };
}

const note = (library: SampleLibrary, topic: string) => library.notes.find((sample) => sample.topic === topic)!;

const overviewIdsIn = (text: string) => [...text.matchAll(/^Overview id: (\S+)$/gm)].map((match) => match[1]);

async function seedMany(reader: TestAccount, count: number, topicId: string) {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const overview = storedOverview({
      topicIds: [TopicId.parse(topicId)],
      savedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    });
    await reader.inject({ method: "POST", url: "/api/overviews", body: overview });
    ids.push(overview.id);
  }
  return ids.reverse();
}

test("search_overviews with no filters lists the whole library, newest saved first, with each id", async () => {
  const { testApp, library, client } = await connectedToSamples();

  const { text } = await client.callTool("search_overviews");

  assert.match(text, /^5 saved overview\(s\) match\./);
  for (const { overview } of library.notes) {
    assert.ok(text.includes(`id ${overview.id}`), overview.video.title);
  }
  await testApp.close();
});

test("search_overviews finds every word of a query, wherever in the note each one is", async () => {
  const { testApp, library, client } = await connectedToSamples();

  const { text } = await client.callTool("search_overviews", { query: "cables hypertrophy" });

  assert.match(text, /^1 saved overview\(s\) match\./);
  assert.ok(text.includes(note(library, "fitness").overview.id));
  await testApp.close();
});

test("search_overviews filters by topic name, verdict and saved date", async () => {
  const { testApp, library, client } = await connectedToSamples();

  const byTopic = await client.callTool("search_overviews", { topic: "Finance" });
  const byVerdict = await client.callTool("search_overviews", { verdict: "original" });
  const byDate = await client.callTool("search_overviews", { savedTo: "2026-09-01" });

  assert.ok(byTopic.text.includes(note(library, "finance").overview.id));
  assert.match(byTopic.text, /^1 saved/);
  assert.ok(byVerdict.text.includes(note(library, "interesting").overview.id));
  assert.match(byVerdict.text, /^1 saved/);
  assert.equal(byDate.text, "No saved overviews match.");
  await testApp.close();
});

test("search_overviews filters by a tag the reader added themselves", async () => {
  const { testApp, reader, library, client } = await connectedToSamples();
  const tagged = note(library, "parenting").overview;
  await reader.inject({
    method: "PUT",
    url: `/api/overviews/${tagged.id}/state`,
    body: { userTags: ["homeschool"], updatedAt: "2026-09-26T08:45:00.000Z" },
  });

  const { text } = await client.callTool("search_overviews", { tag: "homeschool" });

  assert.match(text, /^1 saved/);
  assert.ok(text.includes(tagged.id));
  await testApp.close();
});

test("a topic the library does not have is a failed call that points at list_topics", async () => {
  const { testApp, client } = await connectedToSamples();

  const result = await client.callTool("search_overviews", { topic: "astrology" });

  assert.equal(result.isError, true);
  assert.match(result.text, /list_topics/);
  await testApp.close();
});

test("list_topics counts the overviews under each topic", async () => {
  const { testApp, library, client } = await connectedToSamples();

  const { text } = await client.callTool("list_topics");

  assert.match(text, /^5 topic\(s\):/);
  for (const topic of library.topics) {
    assert.ok(text.includes(`**${topic.name}**: 1 overview(s) · id ${topic.id}`), topic.name);
  }
  await testApp.close();
});

test("list_tags counts the overviews carrying each tag, most used first", async () => {
  const { testApp, library, client } = await connectedToSamples();

  const { text } = await client.callTool("list_tags");

  const tags = new Set(library.notes.flatMap(({ overview }) => overview.tags));
  assert.match(text, new RegExp(`^${tags.size} tag\\(s\\):`));
  for (const tag of tags) {
    assert.ok(text.includes(`- ${tag}: `), tag);
  }
  await testApp.close();
});

test("get_overview returns every real note as Markdown, whichever way its actions were written", async () => {
  const { testApp, library, client } = await connectedToSamples();
  assert.deepEqual(new Set(library.notes.map((sample) => sample.actionStyle)), new Set(["numbered", "dashed"]));

  for (const { overview, topic } of library.notes) {
    const { text, isError } = await client.callTool("get_overview", { id: overview.id });

    assert.equal(isError, false);
    assert.ok(text.startsWith(`Overview id: ${overview.id}\nTopics: ${topic}\n\n# ${overview.video.title}\n`));
    assert.ok(text.includes(overview.video.url));
    assert.ok(text.includes("## How to apply\n\n- "), `${overview.video.title} lists its actions`);
    assert.ok(!text.includes("## How to apply\n\n- 1."), "the list mark is not doubled");
  }
  await testApp.close();
});

test("get_overview links each chapter to its moment in the video", async () => {
  const testApp = await createTestApp();
  const reader = await plusAccount(testApp);
  const overview = storedOverview({
    chapters: [{ title: "The hinge", summary: "Why the swing starts at the hips.", startMs: 95_000, endMs: 180_000 }],
  });
  await reader.inject({ method: "POST", url: "/api/overviews", body: overview });
  const client = await connectMcpClient(testApp, reader);

  const { text } = await client.callTool("get_overview", { id: overview.id });

  assert.ok(text.includes(`[1:35](${overview.video.url}&t=95) **The hinge**`));
  await testApp.close();
});

test("get_overviews reads every overview under a topic in one call, and never a transcript", async () => {
  const { testApp, reader, library, client } = await connectedToSamples();
  const fitness = note(library, "fitness").overview;
  await reader.inject({
    method: "PUT",
    url: `/api/transcripts/${fitness.video.id}`,
    body: makeStoredTranscript({ videoId: VideoId.parse(fitness.video.id!), segments: [{ text: "A line only the transcript has.", startMs: 0, endMs: 3000 }] }),
  });

  const { text } = await client.callTool("get_overviews", { topic: "fitness" });

  assert.deepEqual(overviewIdsIn(text), [fitness.id]);
  assert.ok(text.includes("## Key points"));
  assert.ok(!text.includes("A line only the transcript has."));
  await testApp.close();
});

test("get_overviews reads by ids, and by search", async () => {
  const { testApp, library, client } = await connectedToSamples();
  const chosen = [note(library, "business").overview.id, note(library, "parenting").overview.id];

  const byIds = await client.callTool("get_overviews", { ids: chosen });
  const bySearch = await client.callTool("get_overviews", { query: "heartbeats" });

  assert.deepEqual(new Set(overviewIdsIn(byIds.text)), new Set(chosen));
  assert.deepEqual(overviewIdsIn(bySearch.text), [note(library, "interesting").overview.id]);
  await testApp.close();
});

test("get_overviews stops at its cap and hands back a cursor that reads the rest", async () => {
  const testApp = await createTestApp();
  const reader = await plusAccount(testApp);
  const topic = storedTopic({ name: "strength" });
  await reader.inject({ method: "POST", url: "/api/topics", body: topic });
  const ids = await seedMany(reader, OVERVIEWS_PER_CALL + 3, topic.id);
  const client = await connectMcpClient(testApp, reader);

  const first = await client.callTool("get_overviews", { topic: "strength" });
  const cursor = /cursor "(\d+)"/.exec(first.text)?.[1];
  const second = await client.callTool("get_overviews", { topic: "strength", cursor });

  assert.deepEqual(overviewIdsIn(first.text), ids.slice(0, OVERVIEWS_PER_CALL));
  assert.equal(cursor, String(OVERVIEWS_PER_CALL));
  assert.deepEqual(overviewIdsIn(second.text), ids.slice(OVERVIEWS_PER_CALL));
  assert.doesNotMatch(second.text, /More remain/);
  await testApp.close();
});

test("search_overviews pages its listing past its own, larger page size", async () => {
  const testApp = await createTestApp();
  const reader = await plusAccount(testApp);
  const topic = storedTopic({ name: "strength" });
  await reader.inject({ method: "POST", url: "/api/topics", body: topic });
  await seedMany(reader, LISTING_PAGE_SIZE + 1, topic.id);
  const client = await connectMcpClient(testApp, reader);

  const first = await client.callTool("search_overviews");
  const second = await client.callTool("search_overviews", { cursor: String(LISTING_PAGE_SIZE) });

  assert.equal((first.text.match(/^- \*\*/gm) ?? []).length, LISTING_PAGE_SIZE);
  assert.match(first.text, new RegExp(`cursor "${LISTING_PAGE_SIZE}"`));
  assert.equal((second.text.match(/^- \*\*/gm) ?? []).length, 1);
  await testApp.close();
});

test("get_transcript reads the video's transcript with a time on every paragraph", async () => {
  const { testApp, reader, library, client } = await connectedToSamples();
  const fitness = note(library, "fitness").overview;
  await reader.inject({
    method: "PUT",
    url: `/api/transcripts/${fitness.video.id}`,
    body: makeStoredTranscript({
      videoId: VideoId.parse(fitness.video.id!),
      segments: [
        { text: "Add a set before you add weight.", startMs: 0, endMs: 3000 },
        { text: "Cables keep tension at length.", startMs: 65_000, endMs: 68_000 },
      ],
    }),
  });

  const { text, isError } = await client.callTool("get_transcript", { id: fitness.id });

  assert.equal(isError, false);
  assert.ok(text.startsWith(`${fitness.video.title}\n${fitness.video.channel}\n${fitness.video.url}\n`));
  assert.ok(text.includes("0:00\tAdd a set before you add weight."));
  assert.ok(text.includes("1:05\tCables keep tension at length."));
  await testApp.close();
});

test("get_transcript says so when the transcript was machine-heard", async () => {
  const { testApp, reader, library, client } = await connectedToSamples();
  const fitness = note(library, "fitness").overview;
  await reader.inject({
    method: "PUT",
    url: `/api/transcripts/${fitness.video.id}`,
    body: makeStoredTranscript({ videoId: VideoId.parse(fitness.video.id!), generated: true }),
  });

  const { text } = await client.callTool("get_transcript", { id: fitness.id });

  assert.match(text, /^Machine-transcribed/);
  await testApp.close();
});

test("get_transcript is a failed call when no transcript is kept for the video", async () => {
  const { testApp, library, client } = await connectedToSamples();

  const result = await client.callTool("get_transcript", { id: note(library, "finance").overview.id });

  assert.equal(result.isError, true);
  assert.match(result.text, /No transcript/);
  await testApp.close();
});

test("get_transcript never serves another reader's copy of the same video's transcript", async () => {
  const { testApp, library, client } = await connectedToSamples();
  const fitness = note(library, "fitness").overview;
  const other = await plusAccount(testApp);
  await other.inject({ method: "POST", url: "/api/overviews", body: storedOverview({ video: fitness.video }) });
  await other.inject({
    method: "PUT",
    url: `/api/transcripts/${fitness.video.id}`,
    body: makeStoredTranscript({ videoId: VideoId.parse(fitness.video.id!) }),
  });

  const result = await client.callTool("get_transcript", { id: fitness.id });

  assert.equal(result.isError, true);
  await testApp.close();
});

test("an overview this server cannot read is left out, and the assistant is told how many", async () => {
  const { testApp, reader, client } = await connectedToSamples();
  await reader.seedRaw("overview", OverviewId.parse(randomUUID()), CURRENT_SCHEMA_VERSIONS.overview + 1, { id: "from the future" });

  const { text } = await client.callTool("search_overviews");

  assert.match(text, /^5 saved overview\(s\) match\./);
  assert.match(text, /1 saved overview\(s\) could not be read by this server and are left out\./);
  await testApp.close();
});
