import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_CLIENT_ERROR_BATCH, type ClientWarning, type SentClientError } from "@overview/domain";
import { ErrorQueue, type ErrorQueueOptions, type QueuedErrorBatch } from "./ErrorQueue.js";

const error = (message: string): SentClientError => ({
  source: "uncaught",
  type: "TypeError",
  message,
  handled: false,
  frames: [],
  trail: [],
  at: "2026-10-01T09:00:00.000Z",
});

const makeQueue = (options: Partial<ErrorQueueOptions> = {}) => {
  const sent: Array<QueuedErrorBatch & { keepalive: boolean }> = [];
  let failing = false;
  let reachable = true;
  const queue = new ErrorQueue({
    canSend: () => reachable,
    send: async (batch, { keepalive }) => {
      if (failing) throw new Error("Simulated: offline");
      sent.push({ ...batch, keepalive });
    },
    ...options,
  });
  return {
    queue,
    sent,
    messages: () => sent.map(({ errors }) => errors.map(({ message }) => message)),
    fail: (value: boolean) => (failing = value),
    unreachable: (value: boolean) => (reachable = !value),
  };
};

describe("ErrorQueue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends errors within a second, together", async () => {
    const { queue, messages } = makeQueue();

    queue.record(error("one"));
    queue.record(error("two"));
    await vi.advanceTimersByTimeAsync(1_000);

    expect(messages()).toEqual([["one", "two"]]);
  });

  it("sends at once, to outlive the page, when asked to flush", async () => {
    const { queue, sent } = makeQueue();

    queue.record(error("one"));
    await queue.flush({ keepalive: true });

    expect(sent).toEqual([expect.objectContaining({ keepalive: true })]);
  });

  it("drops past ten a minute, so a render loop can't flood the tracker, and counts how many", async () => {
    const { queue, sent } = makeQueue();

    for (let i = 0; i < 12; i++) queue.record(error(`e${i}`));
    await vi.advanceTimersByTimeAsync(1_000);
    vi.advanceTimersByTime(60_000);
    queue.record(error("later"));
    await vi.advanceTimersByTimeAsync(1_000);

    expect(sent.map(({ errors }) => errors.length)).toEqual([MAX_CLIENT_ERROR_BATCH, 1]);
    expect(sent.map(({ dropped }) => dropped)).toEqual([2, undefined]);
  });

  it("drops a batch that couldn't be sent, or had nowhere to go, rather than retrying it, and counts it", async () => {
    const { queue, sent, fail, unreachable } = makeQueue();

    fail(true);
    queue.record(error("lost"));
    await queue.flush();
    fail(false);
    unreachable(true);
    queue.record(error("nowhere"));
    await queue.flush();
    unreachable(false);
    queue.record(error("sent"));
    await queue.flush();

    expect(sent).toEqual([expect.objectContaining({ errors: [expect.objectContaining({ message: "sent" })], dropped: 2 })]);
  });

  it("sends a warning in the same batch as errors, or alone, and counts it against the same budget", async () => {
    const { queue, sent } = makeQueue({ maxPerMinute: 2 });
    const warning: ClientWarning = { name: "narrationFellBack", reason: "renderFailed", at: "2026-10-02T09:00:00.000Z" };

    queue.recordWarning(warning);
    await queue.flush();
    queue.record(error("one"));
    queue.recordWarning(warning);
    await queue.flush();

    expect(sent).toEqual([
      expect.objectContaining({ errors: [], warnings: [warning] }),
      expect.objectContaining({ errors: [expect.objectContaining({ message: "one" })], dropped: 1 }),
    ]);
    expect(sent[1]).not.toHaveProperty("warnings");
  });
});
