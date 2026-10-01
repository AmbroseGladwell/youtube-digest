import test from "node:test";
import assert from "node:assert/strict";
import type { ClientError } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import { PostHogDeliveryError } from "../postHog/sendPostHogBatch.js";
import { createPostHogErrorSink } from "./postHogErrorSink.js";

const ACCOUNT_ID = "6f1e2d3c-4b5a-4a8e-9b2a-0b8f5f7e3c1d" as AccountId;
const AT = "2026-10-01T09:00:00.000Z";
const context = { surface: "extension", layout: "panel", appVersion: "0.4.1", platform: "macos" } as const;
const error: ClientError = {
  source: "routeBoundary",
  type: "TypeError",
  message: "Cannot read properties of undefined (reading 'title')",
  handled: false,
  frames: [{ function: "ReaderPage", file: "assets/index-Bx3k9.js", line: 12, column: 3456 }],
  requestId: "5b0d2c1e-8f3a-4c6d-9e7b-1a2b3c4d5e6f",
  trail: [{ name: "mcp.consentScreen.shown", at: AT }],
  at: AT,
};

const answering = (status: number) => {
  const sent: Array<{ url: string; body: { api_key: string; batch: Array<Record<string, any>> } }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ url: String(input), body: JSON.parse(init!.body as string) });
    return new Response(null, { status });
  };
  return { sent, fetch };
};

test("an error goes to PostHog's error tracking as an $exception under the account id, with its frames, call id and trail", async () => {
  const { sent, fetch } = answering(200);
  const sink = createPostHogErrorSink({ apiKey: "phc_test", host: "https://eu.i.posthog.com", environment: "production", fetch });

  await sink.capture([error], { accountId: ACCOUNT_ID, context, geoAddress: "81.2.69.0" });

  assert.equal(sent[0]!.url, "https://eu.i.posthog.com/batch/");
  assert.deepEqual(sent[0]!.body.batch, [
    {
      event: "$exception",
      distinct_id: ACCOUNT_ID,
      timestamp: AT,
      properties: {
        $exception_list: [
          {
            type: "TypeError",
            value: "Cannot read properties of undefined (reading 'title')",
            mechanism: { handled: false, synthetic: false },
            stacktrace: {
              type: "raw",
              frames: [
                {
                  platform: "custom",
                  lang: "javascript",
                  function: "ReaderPage",
                  filename: "assets/index-Bx3k9.js",
                  lineno: 12,
                  colno: 3456,
                  in_app: true,
                },
              ],
            },
          },
        ],
        error_source: "routeBoundary",
        request_id: "5b0d2c1e-8f3a-4c6d-9e7b-1a2b3c4d5e6f",
        trail: [{ name: "mcp.consentScreen.shown", at: AT }],
        surface: "extension",
        layout: "panel",
        app_version: "0.4.1",
        platform: "macos",
        environment: "production",
        $ip: "81.2.69.0",
      },
    },
  ]);
});

test("a reader with no account gets a fresh id per error and no person in PostHog", async () => {
  const { sent, fetch } = answering(200);
  let next = 0;
  const sink = createPostHogErrorSink({
    apiKey: "phc_test",
    host: "https://eu.i.posthog.com",
    environment: "production",
    fetch,
    newDistinctId: () => `anonymous-${++next}`,
  });

  await sink.capture([error, error], { accountId: null, context, geoAddress: null });

  const batch = sent[0]!.body.batch;
  assert.deepEqual(batch.map(({ distinct_id }) => distinct_id), ["anonymous-1", "anonymous-2"]);
  assert.ok(batch.every(({ properties }) => properties.$process_person_profile === false));
  assert.ok(batch.every(({ properties }) => !("$ip" in properties)));
});

test("a refusal is an error, for the route to log", async () => {
  const { fetch } = answering(401);
  const sink = createPostHogErrorSink({ apiKey: "phc_wrong", host: "https://eu.i.posthog.com", environment: "production", fetch });

  await assert.rejects(sink.capture([error], { accountId: ACCOUNT_ID, context, geoAddress: null }), PostHogDeliveryError);
});
