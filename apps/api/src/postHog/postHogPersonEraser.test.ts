import test from "node:test";
import assert from "node:assert/strict";
import { createPostHogPersonEraser, PostHogErasureError } from "./postHogPersonEraser.js";

interface Sent {
  url: string;
  method: string;
  authorization: string;
}

const answering = (persons: Array<{ id: string }>, deleteStatus = 204) => {
  const sent: Sent[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const headers = init?.headers as Record<string, string>;
    sent.push({ url: String(input), method: init?.method ?? "GET", authorization: headers.authorization! });
    if (init?.method === "DELETE") return new Response(null, { status: deleteStatus });
    return new Response(JSON.stringify({ results: persons }), { status: 200 });
  };
  return { sent, fetch };
};

const options = { personalApiKey: "phx_test", projectId: "12345", host: "https://eu.posthog.com/" };

test("the person under a distinct id is looked up, then deleted with its events, and the answer is queued", async () => {
  const { sent, fetch } = answering([{ id: "person-uuid" }]);
  const eraser = createPostHogPersonEraser({ ...options, fetch });

  assert.equal(await eraser.erase("account-id"), "queued");
  assert.deepEqual(sent, [
    { url: "https://eu.posthog.com/api/projects/12345/persons/?distinct_id=account-id", method: "GET", authorization: "Bearer phx_test" },
    {
      url: "https://eu.posthog.com/api/projects/12345/persons/person-uuid/?delete_events=true",
      method: "DELETE",
      authorization: "Bearer phx_test",
    },
  ]);
});

test("an id nothing was ever sent under is absent, and nothing is deleted", async () => {
  const { sent, fetch } = answering([]);
  const eraser = createPostHogPersonEraser({ ...options, fetch });

  assert.equal(await eraser.erase("never-seen"), "absent");
  assert.equal(sent.length, 1);
});

test("a refusal from PostHog is an error the caller records, not a success", async () => {
  const { fetch } = answering([{ id: "person-uuid" }], 500);
  const eraser = createPostHogPersonEraser({ ...options, fetch });

  await assert.rejects(eraser.erase("account-id"), PostHogErasureError);
});
