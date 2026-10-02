import { describe, expect, it } from "vitest";
import type { ClientErrorBatch } from "@overview/domain";
import type { ErrorsApi } from "@overview/sync";
import { reportStartupFailure, type ReportStartupFailureOptions } from "./reportStartupFailure.js";

const AT = new Date("2026-10-02T09:00:00.000Z");
const BUILD = { version: "0.4.1", commit: "abc1234", dirty: false };

const memoryStorage = (entries: Record<string, string> = {}): Storage => {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
};

const reporting = (options: Partial<ReportStartupFailureOptions> & Pick<ReportStartupFailureOptions, "surface">) => {
  const sent: Array<{ apiUrl: string; token: string | null; batch: ClientErrorBatch; keepalive: boolean | undefined }> = [];
  let failing = false;
  const createApi = ({ apiUrl, token }: { apiUrl: string; token: string | null }): ErrorsApi => ({
    send: async (batch, sendOptions) => {
      if (failing) throw new Error("Simulated: offline");
      sent.push({ apiUrl, token, batch, keepalive: sendOptions?.keepalive });
    },
  });
  return {
    sent,
    fail: () => (failing = true),
    report: (thrown: unknown) =>
      reportStartupFailure(thrown, { build: BUILD, storage: memoryStorage(), createApi, now: () => AT, ...options }),
  };
};

describe("reportStartupFailure", () => {
  it("sends one startup error from the web app to its own origin, with the build's version", async () => {
    const { sent, report } = reporting({ surface: "web" });

    await report(Object.assign(new Error("The operation failed for reasons unrelated to the database itself"), { name: "UnknownError" }));

    expect(sent).toHaveLength(1);
    expect(sent[0]!.apiUrl).toBe(globalThis.location.origin);
    expect(sent[0]!.keepalive).toBe(true);
    expect(sent[0]!.batch.context).toMatchObject({ surface: "web", layout: "full", appVersion: "0.4.1" });
    expect(sent[0]!.batch.errors).toEqual([
      expect.objectContaining({ source: "startup", type: "UnknownError", handled: true, trail: [], at: AT.toISOString() }),
    ]);
  });

  it("sends the extension's to the server it is connected to, under its session", async () => {
    const storage = memoryStorage({
      "overview.syncConnection.v1": JSON.stringify({ apiUrl: "https://staging.example.test", token: "session-token" }),
    });
    const { sent, report } = reporting({ surface: "extension", layout: "panel", storage, defaultApiUrl: "https://theoverviewapp.com" });

    await report(new Error("IndexedDB is unavailable"));

    expect(sent[0]).toMatchObject({ apiUrl: "https://staging.example.test", token: "session-token" });
    expect(sent[0]!.batch.context.layout).toBe("panel");
  });

  it("sends the extension's to the server it was built for when it was never connected", async () => {
    const { sent, report } = reporting({ surface: "extension", defaultApiUrl: "https://theoverviewapp.com" });

    await report(new Error("IndexedDB is unavailable"));

    expect(sent[0]).toMatchObject({ apiUrl: "https://theoverviewapp.com", token: null });
  });

  it("never throws, even when the report can't be sent", async () => {
    const { report, fail } = reporting({ surface: "web" });
    fail();

    await expect(report(new Error("IndexedDB is unavailable"))).resolves.toBeUndefined();
  });
});
