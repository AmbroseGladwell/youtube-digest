import test from "node:test";
import assert from "node:assert/strict";
import {
  AnalyticsEventBatch,
  MAX_ANALYTICS_BATCH_EVENTS,
  SharedPageEventBatch,
  parseAnalyticsEvent,
  parseSharedPageEvent,
} from "./AnalyticsEventBatch.js";

const AT = "2026-10-01T09:00:00.000Z";
const context = { surface: "web", layout: "full", appVersion: "0.4.1", platform: "macos" } as const;

test("an event in the catalogue with the properties it declares is read", () => {
  assert.deepEqual(parseAnalyticsEvent({ name: "mcp.consentScreen.declined", props: { plan: "free" }, at: AT }), {
    name: "mcp.consentScreen.declined",
    props: { plan: "free" },
    at: AT,
  });
  assert.deepEqual(parseAnalyticsEvent({ name: "mcp.consentScreen.approved", props: {}, at: AT })?.name, "mcp.consentScreen.approved");
});

test("a name the catalogue doesn't have is refused", () => {
  assert.equal(parseAnalyticsEvent({ name: "mcp.consentScreen.opened", props: {}, at: AT }), null);
});

test("free text or a URL in a property is refused, whether declared or not", () => {
  assert.equal(parseAnalyticsEvent({ name: "mcp.consentScreen.declined", props: { plan: "https://x.test/a" }, at: AT }), null);
  assert.equal(
    parseAnalyticsEvent({ name: "mcp.consentScreen.approved", props: { note: "what the reader typed" }, at: AT }),
    null,
  );
});

test("a batch is one context and between one and the maximum number of events", () => {
  const events = [{ name: "mcp.consentScreen.approved", props: {}, at: AT }];
  assert.ok(AnalyticsEventBatch.safeParse({ context, events }).success);
  assert.ok(!AnalyticsEventBatch.safeParse({ context, events: [] }).success);
  assert.ok(
    !AnalyticsEventBatch.safeParse({ context, events: Array(MAX_ANALYTICS_BATCH_EVENTS + 1).fill(events[0]) }).success,
  );
  assert.ok(!AnalyticsEventBatch.safeParse({ context: { ...context, appVersion: "0.4.1 (Reader's Mac)" }, events }).success);
  assert.ok(!AnalyticsEventBatch.safeParse({ context: { ...context, url: "https://x.test" }, events }).success);
});

test("what the app dropped is a count on the batch, not an event", () => {
  const events = [{ name: "mcp.consentScreen.approved", props: {}, at: AT }];
  assert.ok(AnalyticsEventBatch.safeParse({ context, events, dropped: 3 }).success);
  assert.ok(!AnalyticsEventBatch.safeParse({ context, events, dropped: 0 }).success);
  assert.equal(parseAnalyticsEvent({ name: "analytics.queue.dropped", props: { count: 3 }, at: AT }), null);
});

test("a batch from a reader with no account carries the anonymous id they agreed to, and it must be an id", () => {
  const events = [{ name: "analyticsConsent.prompt.accepted", props: { asked: "first" }, at: AT }];
  assert.ok(AnalyticsEventBatch.safeParse({ context, events, anonymousId: "4a1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d" }).success);
  assert.ok(!AnalyticsEventBatch.safeParse({ context, events, anonymousId: "reader@example.com" }).success);
});

test("an overview's id is the one id an event may carry, and it must be an id", () => {
  const overviewId = "0b7c9d2e-4f61-4a8b-9c3d-2e1f0a9b8c7d";
  assert.deepEqual(
    parseAnalyticsEvent({ name: "reader.tabs.switched", props: { overviewId, tab: "chapters" }, at: AT })?.props,
    { overviewId, tab: "chapters" },
  );
  assert.equal(
    parseAnalyticsEvent({ name: "reader.tabs.switched", props: { overviewId: "dQw4w9WgXcQ", tab: "chapters" }, at: AT }),
    null,
  );
  assert.equal(parseAnalyticsEvent({ name: "reader.tabs.switched", props: { tab: "chapters" }, at: AT }), null);
});

test("a shared link's batch carries a view id and can only say what happened on a shared page", () => {
  const events = [{ name: "sharedPage.tabs.switched", props: { tab: "transcript" }, at: AT }];
  const viewId = "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b";
  assert.ok(SharedPageEventBatch.safeParse({ context, viewId, events }).success);
  assert.ok(!SharedPageEventBatch.safeParse({ context, events }).success);
  assert.ok(!SharedPageEventBatch.safeParse({ context, viewId: "visitor-7", events }).success);
  assert.equal(parseSharedPageEvent(events[0]!)?.name, "sharedPage.tabs.switched");
  assert.equal(parseSharedPageEvent({ name: "mcp.consentScreen.approved", props: {}, at: AT }), null);
});
