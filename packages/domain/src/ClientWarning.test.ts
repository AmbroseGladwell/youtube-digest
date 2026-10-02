import test from "node:test";
import assert from "node:assert/strict";
import { ClientErrorBatch } from "./ClientErrorBatch.js";
import { ClientWarning, readClientWarning } from "./ClientWarning.js";

const AT = "2026-10-02T09:00:00.000Z";
const context = { surface: "extension", layout: "panel", appVersion: "0.4.1", platform: "macos" } as const;
const fellThrough: ClientWarning = {
  name: "transcriptFellThrough",
  passed: [{ rung: "shared-cache", outcome: "no-answer" }],
  answeredBy: "extension",
  at: AT,
};

test("a batch can carry warnings without errors, but not nothing at all", () => {
  assert.ok(ClientErrorBatch.safeParse({ context, errors: [], warnings: [fellThrough] }).success);
  assert.ok(!ClientErrorBatch.safeParse({ context, errors: [], warnings: [] }).success);
});

test("a warning is one of the catalogue's, with enums and ids only, never text", () => {
  assert.ok(!ClientWarning.safeParse({ ...fellThrough, name: "somethingElse" }).success);
  assert.ok(!ClientWarning.safeParse({ ...fellThrough, answeredBy: "a transcript" }).success);
  assert.ok(!ClientWarning.safeParse({ ...fellThrough, title: "A reader's video" }).success);
  assert.ok(
    !ClientWarning.safeParse({ name: "narrationFellBack", reason: "renderFailed", requestId: "not an id", at: AT }).success,
  );
});

test("a code the API doesn't have is dropped from a narration warning", () => {
  const read = readClientWarning({ name: "narrationFellBack", reason: "requestFailed", apiErrorCode: "made_up", at: AT });

  assert.deepEqual(read, { name: "narrationFellBack", reason: "requestFailed", at: AT });
});
