import test from "node:test";
import assert from "node:assert/strict";
import { mcpToolCalledEvent } from "./mcpToolCalledEvent.js";

const AT = new Date("2026-10-01T09:00:00.000Z");

test("a call is counted with the assistant it came from, and zero overviews for a tool that returns none", () => {
  assert.deepEqual(mcpToolCalledEvent({ tool: "list_topics", failed: false, overviews: null, durationMs: 12 }, "Claude", AT), {
    name: "mcp.toolCalled",
    props: { tool: "list_topics", assistant: "claude", failed: false, overviews: 0, durationMs: 12 },
    at: "2026-10-01T09:00:00.000Z",
  });
});

test("a call that ran past the catalogue's limit still counts, at the limit", () => {
  assert.equal(
    mcpToolCalledEvent({ tool: "get_transcript", failed: true, overviews: null, durationMs: 900_000 }, null, AT)?.props
      .durationMs,
    600_000,
  );
});

test("a tool the catalogue doesn't know is not counted", () => {
  assert.equal(mcpToolCalledEvent({ tool: "delete_everything", failed: false, overviews: null, durationMs: 1 }, null, AT), null);
});
