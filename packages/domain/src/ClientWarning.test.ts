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
  assert.ok(!ClientWarning.safeParse({ name: "narrationFellBack", reason: "renderFailed", requestId: "not an id", at: AT }).success);
});

test("a code the API doesn't have is dropped from a narration warning", () => {
  const read = readClientWarning({ name: "narrationFellBack", reason: "requestFailed", apiErrorCode: "made_up", at: AT });

  assert.deepEqual(read, { name: "narrationFellBack", reason: "requestFailed", at: AT });
});

test("a sign-out that gave up on its last sync says only how much it left", () => {
  assert.ok(ClientWarning.safeParse({ name: "signOutSyncGaveUp", pending: 3, stuck: 0, at: AT }).success);
  assert.ok(!ClientWarning.safeParse({ name: "signOutSyncGaveUp", pending: -1, stuck: 0, at: AT }).success);
});

test("a chosen model's failure names the provider and the model's id, and nothing shaped like a sentence", () => {
  const failed = { name: "chosenModelFailed", provider: "anthropic", model: "claude-haiku-5-5", reason: "refused", status: 400, at: AT };
  assert.ok(ClientWarning.safeParse(failed).success);
  assert.ok(ClientWarning.safeParse({ ...failed, model: "models/gemini-3.6-flash:latest", reason: "schema", status: undefined }).success);
  assert.ok(!ClientWarning.safeParse({ ...failed, model: "The compiled grammar is too large" }).success);
  assert.ok(!ClientWarning.safeParse({ ...failed, status: 503 }).success);
  assert.ok(!ClientWarning.safeParse({ ...failed, detail: '{"type":"error"}' }).success);
});
