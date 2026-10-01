import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_ANALYTICS_BATCH_EVENTS, type SentAnalyticsEvent } from "@overview/domain";
import { AnalyticsQueue, type AnalyticsQueueOptions } from "./AnalyticsQueue.js";

const START = new Date("2026-10-01T09:00:00.000Z");

const makeQueue = (options: Partial<AnalyticsQueueOptions> = {}) => {
  const sent: Array<{ events: SentAnalyticsEvent[]; keepalive: boolean }> = [];
  let signedIn = true;
  let failing = false;
  const queue = new AnalyticsQueue({
    canSend: () => signedIn,
    send: async (events, { keepalive }) => {
      if (failing) throw new Error("Simulated: offline");
      sent.push({ events, keepalive });
    },
    now: () => new Date(),
    ...options,
  });
  return {
    queue,
    sent,
    names: () => sent.map(({ events }) => events.map(({ name }) => name)),
    signOut: () => (signedIn = false),
    fail: (value: boolean) => (failing = value),
  };
};

describe("AnalyticsQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it("holds events for a moment and sends them together", async () => {
    const { queue, sent, names } = makeQueue();

    queue.record("mcp.consentScreen.shown", {});
    vi.advanceTimersByTime(1_000);
    queue.record("mcp.consentScreen.declined", { plan: "free" });
    expect(sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(names()).toEqual([["mcp.consentScreen.shown", "mcp.consentScreen.declined"]]);
    expect(sent[0]!.events[1]).toEqual({ name: "mcp.consentScreen.declined", props: { plan: "free" }, at: "2026-10-01T09:00:01.000Z" });
    expect(sent[0]!.keepalive).toBe(false);
  });

  it("sends at once, to outlive the page, when asked to flush", async () => {
    const { queue, sent } = makeQueue();

    queue.record("mcp.consentScreen.approved", {});
    await queue.flush({ keepalive: true });

    expect(sent).toEqual([{ events: [expect.objectContaining({ name: "mcp.consentScreen.approved" })], keepalive: true }]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(sent).toHaveLength(1);
  });

  it("collects nothing from a reader who may not be counted, and says nothing about it", async () => {
    const { queue, sent, signOut } = makeQueue();
    signOut();

    queue.record("mcp.consentScreen.shown", {});
    await vi.advanceTimersByTimeAsync(5_000);

    expect(sent).toEqual([]);
  });

  it("forgets what it held if the reader signs out before it is sent", async () => {
    const { queue, sent, signOut } = makeQueue();

    queue.record("mcp.consentScreen.shown", {});
    signOut();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(sent).toEqual([]);
  });

  it("drops past the per-minute cap, and says how many with the next batch that gets through", async () => {
    const { queue, names, sent } = makeQueue({ maxPerMinute: 3 });

    for (let i = 0; i < 5; i++) queue.record("mcp.consentScreen.shown", {});
    await vi.advanceTimersByTimeAsync(2_000);
    vi.advanceTimersByTime(60_000);
    queue.record("mcp.settingsConnections.revoked", {});
    await vi.advanceTimersByTimeAsync(2_000);

    expect(names()).toEqual([
      ["analytics.queue.dropped", "mcp.consentScreen.shown", "mcp.consentScreen.shown", "mcp.consentScreen.shown"],
      ["mcp.settingsConnections.revoked"],
    ]);
    expect(sent[0]!.events[0]!.props).toEqual({ count: 2 });
  });

  it("never holds more than one batch", async () => {
    const { queue, sent } = makeQueue({ maxPerMinute: 1_000 });

    for (let i = 0; i < MAX_ANALYTICS_BATCH_EVENTS + 10; i++) queue.record("mcp.consentScreen.shown", {});
    await vi.advanceTimersByTimeAsync(2_000);

    expect(sent[0]!.events).toHaveLength(MAX_ANALYTICS_BATCH_EVENTS);
    expect(sent[0]!.events[0]).toEqual(expect.objectContaining({ name: "analytics.queue.dropped", props: { count: 11 } }));
  });

  it("drops a batch that couldn't be sent rather than retrying it, and counts it", async () => {
    const { queue, sent, fail } = makeQueue();

    fail(true);
    queue.record("mcp.consentScreen.shown", {});
    queue.record("mcp.consentScreen.approved", {});
    await expect(queue.flush()).resolves.toBeUndefined();
    fail(false);
    queue.record("mcp.settingsConnections.revoked", {});
    await queue.flush();

    expect(sent).toHaveLength(1);
    expect(sent[0]!.events.map(({ name, props }) => [name, props])).toEqual([
      ["analytics.queue.dropped", { count: 2 }],
      ["mcp.settingsConnections.revoked", {}],
    ]);
  });
});
