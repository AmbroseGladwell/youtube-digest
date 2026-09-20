import test from "node:test";
import assert from "node:assert/strict";
import { SupadataError, type JobResult, type Transcript } from "@supadata/js";
import { pollTranscriptJob } from "./pollTranscriptJob.js";
import { TranscriptFetchError } from "../TranscriptFetchError.js";
import type { SupadataClient } from "./SupadataClient.js";

const completedTranscript: Transcript = {
  content: [{ text: "Hello.", offset: 0, duration: 1000, lang: "en" }],
  lang: "en",
  availableLangs: ["en"],
};

function fakeClient(statuses: JobResult<Transcript>[]): SupadataClient {
  let calls = 0;
  return {
    metadata: () => Promise.reject(new Error("not used")),
    transcript: Object.assign(() => Promise.reject(new Error("not used")), {
      getJobStatus: async () => statuses[Math.min(calls++, statuses.length - 1)]!,
    }),
  };
}

test("polls past queued/active states and returns the result once completed", async () => {
  const client = fakeClient([
    { status: "queued" },
    { status: "active" },
    { status: "completed", result: completedTranscript },
  ]);
  const result = await pollTranscriptJob(client, "job-1", { intervalMs: 1, timeoutMs: 1000 });
  assert.deepEqual(result, completedTranscript);
});

test("a failed job surfaces its error message instead of a generic failure", async () => {
  const client = fakeClient([
    { status: "failed", error: { error: "transcript-unavailable", message: "no captions", details: "" } },
  ]);
  await assert.rejects(
    () => pollTranscriptJob(client, "job-1", { intervalMs: 1, timeoutMs: 1000 }),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptFetchError);
      assert.ok(error.message.includes("no captions"));
      assert.equal(error.retryable, false);
      return true;
    },
  );
});

test("a job stuck queued past the timeout is a retryable error, not a hang", async () => {
  const client = fakeClient([{ status: "queued" }]);
  await assert.rejects(
    () => pollTranscriptJob(client, "job-1", { intervalMs: 1, timeoutMs: 5 }),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptFetchError);
      assert.equal(error.retryable, true);
      return true;
    },
  );
});

test("a status read that fails transiently is one lost tick, not an abandoned job", async () => {
  let calls = 0;
  const client: SupadataClient = {
    metadata: () => Promise.reject(new Error("not used")),
    transcript: Object.assign(() => Promise.reject(new Error("not used")), {
      getJobStatus: async (): Promise<JobResult<Transcript>> => {
        calls += 1;
        if (calls === 1) throw new SupadataError({ error: "internal-error" });
        return { status: "completed", result: completedTranscript };
      },
    }),
  };

  const result = await pollTranscriptJob(client, "job-1", { intervalMs: 1, timeoutMs: 1000 });

  assert.deepEqual(result, completedTranscript);
  assert.equal(calls, 2);
});
