import { describe, expect, it } from "vitest";
import type { ClientErrorBatch } from "@overview/domain";
import type { ErrorDestination } from "@overview/app-core";
import { createWorkerErrorReporter } from "./workerErrorReporter.js";

const makeReporter = (destination: ErrorDestination | null, options: { failing?: boolean; maxPerMinute?: number } = {}) => {
  const sent: Array<{ apiUrl: string; token: string | null; batch: ClientErrorBatch; keepalive: boolean | undefined }> = [];
  let failing = options.failing ?? false;
  const reporter = createWorkerErrorReporter({
    readDestination: async () => destination,
    defaultApiUrl: "https://theoverviewapp.com",
    appVersion: "0.4.1",
    maxPerMinute: options.maxPerMinute ?? 10,
    now: () => new Date("2026-10-01T09:00:00.000Z"),
    createApi: ({ apiUrl, token }) => ({
      send: async (batch, sendOptions) => {
        if (failing) throw new Error("Simulated: offline");
        sent.push({ apiUrl, token, batch, keepalive: sendOptions?.keepalive });
      },
    }),
  });
  return { reporter, sent, recover: () => (failing = false) };
};

describe("createWorkerErrorReporter", () => {
  it("sends each error at once, on its own and to outlive the worker, to the reader's server under their session", async () => {
    const { reporter, sent } = makeReporter({ apiUrl: "https://sync.example", token: "bearer" });

    await reporter.report(new TypeError("x is not a function"));

    expect(sent).toEqual([
      {
        apiUrl: "https://sync.example",
        token: "bearer",
        keepalive: true,
        batch: {
          context: { surface: "extension", layout: "worker", appVersion: "0.4.1", platform: expect.any(String) },
          errors: [expect.objectContaining({ source: "serviceWorker", type: "TypeError", handled: false, trail: [] })],
        },
      },
    ]);
  });

  it("with no page having said where errors go, sends them to the server the extension was built for, under no session", async () => {
    const { reporter, sent } = makeReporter(null);

    await reporter.report(new Error("boom"));

    expect(sent[0]).toMatchObject({ apiUrl: "https://theoverviewapp.com", token: null });
  });

  it("redacts what it sends, as the app does", async () => {
    const { reporter, sent } = makeReporter(null);

    await reporter.report(new Error("No overview for https://www.youtube.com/watch?v=dQw4w9WgXcQ"));

    expect(sent[0]!.batch.errors[0]!.message).toBe("No overview for <url>");
  });

  it("drops past the per-minute cap, and a send that failed, and counts both on the next one that gets through", async () => {
    const { reporter, sent, recover } = makeReporter(null, { failing: true, maxPerMinute: 2 });

    await reporter.report(new Error("lost"));
    recover();
    await reporter.report(new Error("sent"));
    await reporter.report(new Error("over the cap"));

    expect(sent.map(({ batch }) => [batch.errors[0]!.message, batch.dropped])).toEqual([["sent", 1]]);
  });
});
