import { describe, expect, it } from "vitest";
import { INITIAL_SYNC_STATUS, type SyncStatus } from "@overview/sync";
import { syncStatusLine } from "./syncStatusLine.js";

const NOW = new Date("2026-09-26T12:00:00.000Z");
const status = (overrides: Partial<SyncStatus>): SyncStatus => ({ ...INITIAL_SYNC_STATUS, ...overrides });

describe("syncStatusLine", () => {
  it("says connected before the first cycle has finished", () => {
    expect(syncStatusLine(status({}), NOW)).toBe("Connected");
  });

  it("dates the last successful cycle relative to now", () => {
    expect(syncStatusLine(status({ lastSyncedAt: "2026-09-26T11:59:50.000Z" }), NOW)).toBe("Synced just now");
    expect(syncStatusLine(status({ lastSyncedAt: "2026-09-26T11:45:00.000Z" }), NOW)).toBe("Synced 15 minutes ago");
    expect(syncStatusLine(status({ lastSyncedAt: "2026-09-26T09:00:00.000Z" }), NOW)).toBe("Synced 3 hours ago");
    expect(syncStatusLine(status({ lastSyncedAt: "2026-09-24T09:00:00.000Z" }), NOW)).toBe("Synced 2 days ago");
  });

  it("always carries what is still waiting, whatever the phase", () => {
    expect(syncStatusLine(status({ phase: "offline", pending: 3 }), NOW)).toBe(
      "Offline. Your changes will go when the connection is back. · 3 changes waiting to send",
    );
    expect(syncStatusLine(status({ lastSyncedAt: NOW.toISOString(), pending: 1, stuck: 2 }), NOW)).toBe(
      "Synced just now · 1 change waiting to send · 2 couldn't be sent",
    );
  });

  it("names the way out for a refused token and for a client below the floor", () => {
    expect(syncStatusLine(status({ phase: "signedOut" }), NOW)).toMatch(/refused this token/);
    expect(syncStatusLine(status({ phase: "unsupported" }), NOW)).toMatch(/Update it/);
  });
});
