import test from "node:test";
import assert from "node:assert/strict";
import { ClientErrorBatch, MAX_CLIENT_ERROR_BATCH, readClientError, type SentClientError } from "./ClientErrorBatch.js";

const AT = "2026-10-01T09:00:00.000Z";
const context = { surface: "web", layout: "full", appVersion: "0.4.1", platform: "macos" } as const;
const sent: SentClientError = {
  source: "routeBoundary",
  type: "TypeError",
  message: "Cannot read properties of undefined (reading 'title')",
  handled: false,
  frames: [{ function: "ReaderPage", file: "assets/index-Bx3k9.js", line: 12, column: 3456 }],
  trail: [{ name: "mcp.consentScreen.shown", at: AT }],
  at: AT,
};

test("a batch is one context and between one and the maximum number of errors", () => {
  assert.ok(ClientErrorBatch.safeParse({ context, errors: [sent] }).success);
  assert.ok(ClientErrorBatch.safeParse({ context, errors: [sent], dropped: 2 }).success);
  assert.ok(!ClientErrorBatch.safeParse({ context, errors: [] }).success);
  assert.ok(!ClientErrorBatch.safeParse({ context, errors: Array(MAX_CLIENT_ERROR_BATCH + 1).fill(sent) }).success);
});

test("a frame can hold a function name and a path in the bundle, and not a page's address or a sentence", () => {
  const withFrame = (frame: object) => ClientErrorBatch.safeParse({ context, errors: [{ ...sent, frames: [frame] }] }).success;
  assert.ok(withFrame({ function: "Object.<anonymous>", file: "assets/index-Bx3k9.js", line: 1, column: 2 }));
  assert.ok(!withFrame({ function: "f", file: "https://overview.test/reader/abc?v=dQw4w9WgXcQ", line: 1, column: 2 }));
  assert.ok(!withFrame({ function: "what, the reader typed!", file: "a.js", line: 1, column: 2 }));
});

test("an error's type is a class name, never a sentence", () => {
  assert.ok(!ClientErrorBatch.safeParse({ context, errors: [{ ...sent, type: "Something about my note" }] }).success);
});

test("the server redacts the message again rather than take the client's word for it", () => {
  const read = readClientError({ ...sent, message: `Failed "My private note" at https://x.test/a` });
  assert.equal(read.message, "Failed <text> at <url>");
});

test("a trail keeps only names in the catalogue, and a code keeps only codes the API has", () => {
  const read = readClientError({
    ...sent,
    apiErrorCode: "my own words",
    trail: [{ name: "mcp.consentScreen.shown", at: AT }, { name: "Watched my video", at: AT }],
  });
  assert.deepEqual(read.trail, [{ name: "mcp.consentScreen.shown", at: AT }]);
  assert.ok(!("apiErrorCode" in read));
  assert.equal(readClientError({ ...sent, apiErrorCode: "revision_mismatch" }).apiErrorCode, "revision_mismatch");
});
