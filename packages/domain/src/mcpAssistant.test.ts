import test from "node:test";
import assert from "node:assert/strict";
import { mcpAssistant } from "./mcpAssistant.js";

test("an assistant is counted as one of a few, whatever it called itself", () => {
  assert.equal(mcpAssistant("Claude"), "claude");
  assert.equal(mcpAssistant("claude-ai"), "claude");
  assert.equal(mcpAssistant("ChatGPT"), "chatgpt");
  assert.equal(mcpAssistant("OpenAI Connector"), "chatgpt");
  assert.equal(mcpAssistant("My reader's own script"), "other");
  assert.equal(mcpAssistant(null), "other");
});
