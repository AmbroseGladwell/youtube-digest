import test from "node:test";
import assert from "node:assert/strict";
import type { AccountId } from "../auth/AccountId.js";
import { PostHogDeliveryError } from "../postHog/sendPostHogBatch.js";
import { createPostHogEventSink } from "./postHogEventSink.js";

const ACCOUNT_ID = "6f1e2d3c-4b5a-4a8e-9b2a-0b8f5f7e3c1d" as AccountId;
const source = {
  accountId: ACCOUNT_ID,
  context: { surface: "web", layout: "full", appVersion: "0.4.1", platform: "windows" },
  geoAddress: "81.2.69.0",
} as const;

const answering = (status: number) => {
  const sent: Array<{ url: string; body: unknown }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ url: String(input), body: JSON.parse(init!.body as string) });
    return new Response(null, { status });
  };
  return { sent, fetch };
};

test("a batch goes to PostHog's batch endpoint as one call, each event under the account id with the app's context", async () => {
  const { sent, fetch } = answering(200);
  const sink = createPostHogEventSink({ apiKey: "phc_test", host: "https://eu.i.posthog.com/", environment: "production", fetch });

  await sink.capture(
    [
      { name: "mcp.consentScreen.declined", props: { plan: "free" }, at: "2026-10-01T09:00:00.000Z" },
      { name: "mcp.settingsConnections.revoked", props: {}, at: "2026-10-01T09:00:01.000Z" },
    ],
    source,
  );

  assert.deepEqual(sent, [
    {
      url: "https://eu.i.posthog.com/batch/",
      body: {
        api_key: "phc_test",
        batch: [
          {
            event: "mcp.consentScreen.declined",
            distinct_id: ACCOUNT_ID,
            timestamp: "2026-10-01T09:00:00.000Z",
            properties: {
              plan: "free",
              surface: "web",
              layout: "full",
              app_version: "0.4.1",
              platform: "windows",
              environment: "production",
              $ip: "81.2.69.0",
            },
          },
          {
            event: "mcp.settingsConnections.revoked",
            distinct_id: ACCOUNT_ID,
            timestamp: "2026-10-01T09:00:01.000Z",
            properties: {
              surface: "web",
              layout: "full",
              app_version: "0.4.1",
              platform: "windows",
              environment: "production",
              $ip: "81.2.69.0",
            },
          },
        ],
      },
    },
  ]);
});

test("with no address to place the caller by, none is sent, so PostHog doesn't place them where the server is", async () => {
  const { sent, fetch } = answering(200);
  const sink = createPostHogEventSink({ apiKey: "phc_test", host: "https://eu.i.posthog.com", environment: "development", fetch });

  await sink.capture([{ name: "mcp.settingsConnections.revoked", props: {}, at: "2026-10-01T09:00:00.000Z" }], {
    ...source,
    geoAddress: null,
  });

  const [event] = (sent[0]!.body as { batch: Array<{ properties: Record<string, unknown> }> }).batch;
  assert.ok(!("$ip" in event!.properties));
});

test("a refusal is an error, for the route to log", async () => {
  const { fetch } = answering(401);
  const sink = createPostHogEventSink({ apiKey: "phc_wrong", host: "https://eu.i.posthog.com", environment: "production", fetch });

  await assert.rejects(
    sink.capture([{ name: "mcp.settingsConnections.revoked", props: {}, at: "2026-10-01T09:00:00.000Z" }], source),
    PostHogDeliveryError,
  );
});

test("someone on a shared link with no account is one page load in PostHog, with no person made for them", async () => {
  const { sent, fetch } = answering(200);
  const sink = createPostHogEventSink({ apiKey: "phc_test", host: "https://eu.i.posthog.com", environment: "production", fetch });

  await sink.capture([{ name: "sharedPage.tabs.switched", props: { tab: "chapters" }, at: "2026-10-02T09:00:00.000Z" }], {
    ...source,
    accountId: null,
    viewId: "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b",
  });

  const [captured] = (sent[0]!.body as { batch: Array<{ distinct_id: string; properties: Record<string, unknown> }> }).batch;
  assert.equal(captured!.distinct_id, "shared-view:6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b");
  assert.equal(captured!.properties.$process_person_profile, false);
});

test("a reader with no account who agreed to share is counted under their anonymous id, and no person is made for it", async () => {
  const { sent, fetch } = answering(200);
  const sink = createPostHogEventSink({ apiKey: "phc_test", host: "https://eu.i.posthog.com", environment: "production", fetch });

  await sink.capture([{ name: "analyticsConsent.prompt.accepted", props: { asked: "first" }, at: "2026-10-03T09:00:00.000Z" }], {
    ...source,
    accountId: null,
    anonymousId: "4a1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  });

  const [captured] = (sent[0]!.body as { batch: Array<{ distinct_id: string; properties: Record<string, unknown> }> }).batch;
  assert.equal(captured!.distinct_id, "4a1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");
  assert.equal(captured!.properties.$process_person_profile, false);
});
