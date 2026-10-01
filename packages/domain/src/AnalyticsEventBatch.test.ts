import test from "node:test";
import assert from "node:assert/strict";
import { AnalyticsEventBatch, MAX_ANALYTICS_BATCH_EVENTS, parseAnalyticsEvent } from "./AnalyticsEventBatch.js";

const AT = "2026-10-01T09:00:00.000Z";
const context = { surface: "web", layout: "full", appVersion: "0.4.1", platform: "macos" } as const;

test("an event in the catalogue with the properties it declares is read", () => {
  assert.deepEqual(parseAnalyticsEvent({ name: "consent.declined", props: { plan: "free" }, at: AT }), {
    name: "consent.declined",
    props: { plan: "free" },
    at: AT,
  });
  assert.deepEqual(parseAnalyticsEvent({ name: "consent.approved", props: {}, at: AT })?.name, "consent.approved");
});

test("a name the catalogue doesn't have is refused", () => {
  assert.equal(parseAnalyticsEvent({ name: "consent.opened", props: {}, at: AT }), null);
});

test("free text or a URL in a property is refused, whether declared or not", () => {
  assert.equal(parseAnalyticsEvent({ name: "consent.declined", props: { plan: "https://x.test/a" }, at: AT }), null);
  assert.equal(
    parseAnalyticsEvent({ name: "consent.approved", props: { note: "what the reader typed" }, at: AT }),
    null,
  );
  assert.equal(parseAnalyticsEvent({ name: "analytics.dropped", props: { count: 0 }, at: AT }), null);
});

test("a batch is one context and between one and the maximum number of events", () => {
  const events = [{ name: "consent.approved", props: {}, at: AT }];
  assert.ok(AnalyticsEventBatch.safeParse({ context, events }).success);
  assert.ok(!AnalyticsEventBatch.safeParse({ context, events: [] }).success);
  assert.ok(
    !AnalyticsEventBatch.safeParse({ context, events: Array(MAX_ANALYTICS_BATCH_EVENTS + 1).fill(events[0]) }).success,
  );
  assert.ok(!AnalyticsEventBatch.safeParse({ context: { ...context, appVersion: "0.4.1 (Reader's Mac)" }, events }).success);
  assert.ok(!AnalyticsEventBatch.safeParse({ context: { ...context, url: "https://x.test" }, events }).success);
});
