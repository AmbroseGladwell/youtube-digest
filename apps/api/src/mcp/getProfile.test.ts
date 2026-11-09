import test from "node:test";
import assert from "node:assert/strict";
import type { LearnedItem, LearnedItems } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { connectMcpClient } from "./McpClient.testHelper.js";
import { NOTHING_KNOWN, SHARING_OFF } from "./getProfile.js";

const AT = "2026-11-01T09:00:00.000Z";
let updates = 0;

const item = (text: string, source: string, changes: Partial<LearnedItem> = {}): LearnedItems => ({
  [text.toLowerCase()]: { text, source, learnedAt: AT, noticedAt: AT, removedAt: null, ...changes },
});

async function patchSettings(reader: TestAccount, patch: Record<string, unknown>) {
  updates += 1;
  const updatedAt = new Date(Date.UTC(2026, 10, 9, 9, 0, updates)).toISOString();
  const response = await reader.inject({ method: "PUT", url: "/api/settings", body: { ...patch, updatedAt } });
  assert.equal(response.statusCode, 200, response.body);
}

test("get_profile serves the reader's sentence and what was learned, each item with what it rests on", async () => {
  const testApp = await createTestApp();
  const reader = await makeAccount(testApp);
  await patchSettings(reader, {
    aboutYou: { who: ["dad"], time: [], focus: ["sleep"] },
    learned: {
      ...item("Building a habit tracker app", "From 4 overviews on app growth"),
      ...item("Training for a marathon", "From 3 overviews on running", { removedAt: AT }),
      ...item("Learning Rust", "From 2 overviews on programming", { noticedAt: null }),
    },
  });
  const client = await connectMcpClient(testApp, reader);

  const { text, isError } = await client.callTool("get_profile");

  assert.equal(isError, false);
  assert.ok(text.includes(`"I'm a dad, and right now I'm focusing on sleep."`), text);
  assert.ok(text.includes("- Building a habit tracker app (From 4 overviews on app growth)"), text);
  assert.ok(!text.includes("marathon"), "a removed item is never served");
  assert.ok(!text.includes("Rust"), "an item the reader hasn't been shown is never served");
  await testApp.close();
});

test("an item removed after the connection was made is not served from then on", async () => {
  const testApp = await createTestApp();
  const reader = await makeAccount(testApp);
  await patchSettings(reader, { learned: item("Building a habit tracker app", "From 4 overviews on app growth") });
  const client = await connectMcpClient(testApp, reader);

  await patchSettings(reader, { learned: item("Building a habit tracker app", "From 4 overviews on app growth", { removedAt: AT }) });
  const { text, isError } = await client.callTool("get_profile");

  assert.equal(isError, false);
  assert.equal(text, NOTHING_KNOWN);
  await testApp.close();
});

test("with nothing known, get_profile says so plainly and hands over no profile", async () => {
  const testApp = await createTestApp();
  const reader = await makeAccount(testApp);
  const client = await connectMcpClient(testApp, reader);

  const { text, isError } = await client.callTool("get_profile");

  assert.equal(isError, false);
  assert.equal(text, NOTHING_KNOWN);
  await testApp.close();
});

test("a reader who turned sharing off gets a failed call naming where to turn it back on, and turning it on serves it at once", async () => {
  const testApp = await createTestApp();
  const reader = await makeAccount(testApp);
  await patchSettings(reader, { aboutYou: { who: ["dad"], time: [], focus: [] }, shareProfileWithAssistants: false });
  const client = await connectMcpClient(testApp, reader);

  const off = await client.callTool("get_profile");
  await patchSettings(reader, { shareProfileWithAssistants: true });
  const on = await client.callTool("get_profile");

  assert.equal(off.isError, true);
  assert.equal(off.text, SHARING_OFF);
  assert.ok(!off.text.includes("dad"));
  assert.equal(on.isError, false);
  assert.match(on.text, /I'm a dad/);
  await testApp.close();
});

test("a connection approved before the profile scope is not offered get_profile, and is told to reconnect if it calls it anyway", async () => {
  const testApp = await createTestApp();
  const reader = await makeAccount(testApp);
  await patchSettings(reader, { aboutYou: { who: ["dad"], time: [], focus: [] } });
  const client = await connectMcpClient(testApp, reader, "overviews:read overviews:write");

  const { instructions } = (await client.request("initialize", { protocolVersion: "2025-06-18", capabilities: {} })) as { instructions: string };
  const { tools } = (await client.request("tools/list")) as { tools: Array<{ name: string }> };
  const refused = await client.callTool("get_profile");

  assert.match(instructions, /reconnects it from Settings › Connections/);
  assert.ok(!tools.some((tool) => tool.name === "get_profile"));
  assert.ok(tools.some((tool) => tool.name === "mark_overviews"));
  assert.equal(refused.isError, true);
  assert.match(refused.text, /Settings › Connections/);
  assert.ok(!refused.text.includes("dad"));
  await testApp.close();
});
