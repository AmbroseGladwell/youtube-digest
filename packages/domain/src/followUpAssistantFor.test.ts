import test from "node:test";
import assert from "node:assert/strict";
import type { Connection } from "./Connection.js";
import { connectionAssistant } from "./FollowUpAssistant.js";
import { followUpAssistantFor } from "./followUpAssistantFor.js";

const connection = (clientName: string | null): Connection => ({
  id: clientName ?? "unnamed",
  clientName,
  createdAt: "2026-11-14T10:00:00.000Z",
  lastUsedAt: "2026-11-14T10:00:00.000Z",
  readsProfile: true,
  writes: false,
});

test("a connection is known by the name its client registered with", () => {
  assert.equal(connectionAssistant("claude-ai"), "claude");
  assert.equal(connectionAssistant("ChatGPT"), "chatgpt");
  assert.equal(connectionAssistant("Gemini CLI"), "gemini");
  assert.equal(connectionAssistant("Cursor"), null);
  assert.equal(connectionAssistant(null), null);
});

test("with nothing chosen and no connection, the reader is asked to pick", () => {
  assert.deepEqual(followUpAssistantFor(null, []), { assistant: null, connected: false });
  assert.deepEqual(followUpAssistantFor(null, [connection("Cursor")]), { assistant: null, connected: false });
});

test("with nothing chosen, the one assistant the reader connected is chosen for them", () => {
  assert.deepEqual(followUpAssistantFor(null, [connection("ChatGPT"), connection("Cursor")]), { assistant: "chatgpt", connected: true });
  assert.deepEqual(followUpAssistantFor(null, [connection("Claude"), connection("claude-ai")]), { assistant: "claude", connected: true });
});

test("connected to two assistants, nothing is guessed", () => {
  assert.deepEqual(followUpAssistantFor(null, [connection("Claude"), connection("ChatGPT")]), { assistant: null, connected: false });
});

test("the reader's choice wins, and says whether that assistant is connected", () => {
  assert.deepEqual(followUpAssistantFor("gemini", [connection("Claude")]), { assistant: "gemini", connected: false });
  assert.deepEqual(followUpAssistantFor("claude", [connection("Claude"), connection("ChatGPT")]), { assistant: "claude", connected: true });
});
