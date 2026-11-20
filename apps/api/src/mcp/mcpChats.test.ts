import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chatRecordId, CURRENT_SCHEMA_VERSIONS, type ChatMessage } from "@overview/domain";
import { makeProject } from "@overview/store-conformance";
import { appendChatMessages } from "../chats/appendChatMessages.js";
import { RecordsRepository } from "../records/RecordsRepository.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { sampleLibrary, type SampleLibrary } from "../testing/sampleLibrary.testHelper.js";
import { UPDATED_AT } from "../testing/storedRecords.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { connectMcpClient, seedLibrary, type McpClient } from "./McpClient.testHelper.js";

interface Connected {
  testApp: TestApp;
  reader: TestAccount;
  library: SampleLibrary;
  client: McpClient;
  chat(overviewIndex: number, messages: ChatMessage[], at?: string): Promise<string>;
}

async function connected(t: test.TestContext): Promise<Connected> {
  const testApp = await createTestApp();
  t.after(() => testApp.close());
  const reader = await makeAccount(testApp);
  const library = sampleLibrary();
  await seedLibrary(reader, library);
  const records = new RecordsRepository(testApp.sql, () => testApp.clock.now);
  return {
    testApp,
    reader,
    library,
    client: await connectMcpClient(testApp, reader, "overviews:read"),
    chat: async (overviewIndex, messages, at) => {
      const overviewId = library.notes[overviewIndex]!.overview.id;
      const conversationId = randomUUID();
      await appendChatMessages(
        records,
        reader.accountId,
        { owner: { kind: "overview", id: overviewId }, conversationId, messages },
        at === undefined ? testApp.clock.now : new Date(at),
      );
      return chatRecordId(overviewId, conversationId);
    },
  };
}

const exchange = (
  question: string,
  answer: string,
  at: string,
  more: Partial<Extract<ChatMessage, { from: "answer" }>> = {},
): ChatMessage[] => [
  { from: "reader", text: question, at },
  { from: "answer", text: answer, at, citations: [{ startMs: 61_000, endMs: 70_000 }], inSource: true, ...more },
];

test("list_chats lists the reader's conversations newest first, by overview, and says so when there are none", async (t) => {
  const { client, chat, library } = await connected(t);
  assert.match((await client.callTool("list_chats")).text, /^The reader has no conversations yet\./);

  const older = await chat(0, exchange("How much creatine?", "Three to five grams.", "2026-11-01T10:00:00.000Z"));
  const newer = await chat(1, exchange("Is it worth it?", "Yes, for most people.", "2026-11-02T10:00:00.000Z"));

  const all = (await client.callTool("list_chats")).text;
  assert.match(all, /^2 conversation\(s\)\./);
  assert.ok(all.indexOf(newer) < all.indexOf(older), "newest first");
  assert.match(all, /"How much creatine\?"\n {2}about ".+" \(overview id .+\) · 1 question\(s\) · last 2026-11-01/);

  const one = (await client.callTool("list_chats", { overview: library.notes[0]!.overview.id })).text;
  assert.ok(one.includes(older) && !one.includes(newer));
  assert.match(
    (await client.callTool("list_chats", { overview: library.notes[2]!.overview.id })).text,
    /^No conversations about these overviews\./,
  );
  assert.equal((await client.callTool("list_chats", { overview: randomUUID() })).isError, true);
});

test("list_chats by project lists only conversations about the project's overviews", async (t) => {
  const { client, chat, reader, library } = await connected(t);
  const project = { ...makeProject({ name: "Training" }), schemaVersion: CURRENT_SCHEMA_VERSIONS.project, updatedAt: UPDATED_AT };
  assert.equal((await reader.inject({ method: "POST", url: "/api/projects", body: project })).statusCode, 201);
  const member = library.notes[1]!.overview.id;
  await reader.inject({
    method: "PUT",
    url: `/api/projects/${project.id}/members/${member}`,
    body: { addedAt: UPDATED_AT, updatedAt: UPDATED_AT },
  });
  const outside = await chat(0, exchange("Outside?", "Yes.", UPDATED_AT));
  const inside = await chat(1, exchange("Inside?", "Yes.", UPDATED_AT));

  const listed = (await client.callTool("list_chats", { project: "Training" })).text;

  assert.ok(listed.includes(inside) && !listed.includes(outside));
  assert.equal((await client.callTool("list_chats", { project: "Nowhere" })).isError, true);
});

test("get_chat reads a conversation with its citations as timestamp links, another chat it built on, and an answer the source didn't cover", async (t) => {
  const { client, chat, library } = await connected(t);
  const overview = library.notes[0]!.overview;
  const first = await chat(0, exchange("When should I take it?", "After training.", UPDATED_AT));
  const second = await chat(0, [
    ...exchange("Remind me when?", "As you decided, after training.", UPDATED_AT, {
      citations: [{ chatId: first, message: 1 }],
      inSource: false,
    }),
    ...exchange("How much?", "Three to five grams.", UPDATED_AT),
  ]);

  const read = (await client.callTool("get_chat", { id: second })).text;

  assert.match(read, new RegExp(`Conversation id: ${second} · overview id ${overview.id}`));
  assert.match(read, /1\. \*\*The reader asked\*\* \(2026-09-26\): Remind me when\?/);
  assert.match(read, /The video doesn't cover this; anything the answer adds is general knowledge, not from the video\./);
  assert.ok(read.includes(`Cites: message 2 of conversation ${first}.`));
  assert.match(read, /Cites: \[1:01–1:10\]\(https:\/\/(www\.)?youtube\.com\/watch\?v=[^&)]+&t=61\)\./);
  assert.equal((await client.callTool("get_chat", { id: chatRecordId(overview.id, randomUUID()) })).isError, true);
});

test("get_overview names the overview's conversations, and a deleted one appears nowhere", async (t) => {
  const { client, chat, reader, library } = await connected(t);
  const overviewId = library.notes[0]!.overview.id;
  assert.ok(!(await client.callTool("get_overview", { id: overviewId })).text.includes("conversation(s) about this overview"));
  const kept = await chat(0, exchange("Kept?", "Yes.", UPDATED_AT));
  const deleted = await chat(0, exchange("Deleted?", "Yes.", UPDATED_AT));
  assert.equal((await reader.inject({ method: "DELETE", url: `/api/chats/${overviewId}/${deleted.split(":")[1]}` })).statusCode, 200);

  const overview = (await client.callTool("get_overview", { id: overviewId })).text;

  assert.match(
    overview,
    new RegExp(`The reader has 1 conversation\\(s\\) about this overview in the app; read one with get_chat: ${kept}\\.$`),
  );
  assert.ok(!(await client.callTool("list_chats")).text.includes(deleted));
  assert.equal((await client.callTool("get_chat", { id: deleted })).isError, true);
});

test("no tool writes to a chat, and the instructions point an assistant at them", async (t) => {
  const { client } = await connected(t);
  const { tools } = (await client.request("tools/list")) as { tools: Array<{ name: string; annotations?: { readOnlyHint?: boolean } }> };
  const chatTools = tools.filter((tool) => tool.name.includes("chat"));
  assert.deepEqual(chatTools.map((tool) => tool.name).sort(), ["get_chat", "list_chats"]);
  assert.ok(chatTools.every((tool) => tool.annotations?.readOnlyHint !== false));
});

test("a long conversation is read a page of messages at a time, numbered as in the whole", async (t) => {
  const { client, chat } = await connected(t);
  const id = await chat(
    0,
    Array.from({ length: 12 }, (_, index) => exchange(`Question ${index + 1}?`, `Answer ${index + 1}.`, UPDATED_AT)).flat(),
  );

  const first = (await client.callTool("get_chat", { id })).text;
  const second = (await client.callTool("get_chat", { id, cursor: "20" })).text;

  assert.match(first, /· 24 messages/);
  assert.match(first, /20\. \*\*The answer\*\* \(2026-09-26\): Answer 10\./);
  assert.ok(!first.includes("Question 11?"));
  assert.match(first, /These are messages 1–20 of 24\. More remain: call again with cursor "20"\.$/);
  assert.match(second, /21\. \*\*The reader asked\*\* \(2026-09-26\): Question 11\?/);
  assert.ok(!second.includes("More remain"));
});

test("a project's chat and a library chat are listed by what they're over, read in sections, and filtered by project or library (OV-353)", async (t) => {
  const { client, reader, testApp, library } = await connected(t);
  const project = { ...makeProject({ name: "Training" }), schemaVersion: CURRENT_SCHEMA_VERSIONS.project, updatedAt: UPDATED_AT };
  assert.equal((await reader.inject({ method: "POST", url: "/api/projects", body: project })).statusCode, 201);
  const records = new RecordsRepository(testApp.sql, () => testApp.clock.now);
  const cited = { overviewId: library.notes[0]!.overview.id, title: library.notes[0]!.overview.source.title, item: null };
  const sectioned: ChatMessage[] = [
    { from: "reader", text: "What do they share?", at: UPDATED_AT },
    {
      from: "answer",
      text: "Most start small.",
      at: UPDATED_AT,
      citations: [cited],
      inSource: false,
      sections: {
        intro: "Most start small.",
        sections: [{ heading: "Scope", points: [{ text: "Begin with one habit.", citations: [cited] }] }],
        takeaway: "Pick one.",
      },
      stats: { overviews: 3, projects: 1 },
    },
  ];
  const write = async (owner: Parameters<typeof chatRecordId>[0]) => {
    const conversationId = randomUUID();
    await appendChatMessages(records, reader.accountId, { owner: owner as never, conversationId, messages: sectioned }, testApp.clock.now);
    return chatRecordId(owner, conversationId);
  };
  const onProject = await write({ kind: "project", id: project.id });
  const overLibrary = await write({ kind: "library" });

  const all = (await client.callTool("list_chats")).text;
  assert.match(all, /on the project "Training"/);
  assert.match(all, /over the whole library/);
  const byProject = (await client.callTool("list_chats", { project: "Training" })).text;
  assert.ok(byProject.includes(onProject) && !byProject.includes(overLibrary));
  const byLibrary = (await client.callTool("list_chats", { library: true })).text;
  assert.ok(byLibrary.includes(overLibrary) && !byLibrary.includes(onProject));

  const read = (await client.callTool("get_chat", { id: onProject })).text;
  assert.match(read, /^# A conversation over the reader's project "Training"/);
  assert.match(read, /1\. Scope\n {6}- Begin with one habit\. \(from "/);
  assert.match((await client.callTool("get_chat", { id: overLibrary })).text, /^# A conversation over the reader's whole library/);

  assert.equal((await reader.inject({ method: "DELETE", url: `/api/projects/${project.id}` })).statusCode < 300, true);
  assert.equal((await client.callTool("get_chat", { id: onProject })).isError, true);
});
