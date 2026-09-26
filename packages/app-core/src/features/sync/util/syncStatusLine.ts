import type { SyncStatus } from "@overview/sync";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatSyncedAgo(lastSyncedAt: string, now: Date): string {
  const elapsed = now.getTime() - new Date(lastSyncedAt).getTime();
  if (elapsed < MINUTE_MS) return "Synced just now";
  const format = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  if (elapsed < HOUR_MS) return `Synced ${format.format(-Math.floor(elapsed / MINUTE_MS), "minute")}`;
  if (elapsed < DAY_MS) return `Synced ${format.format(-Math.floor(elapsed / HOUR_MS), "hour")}`;
  return `Synced ${format.format(-Math.floor(elapsed / DAY_MS), "day")}`;
}

// The one line Settings shows about sync. It says what the last cycle found, and it
// always carries what is still waiting, because a library that is quietly behind is the
// failure this project exists to avoid (docs/features/sync-client.md).
export function syncStatusLine(status: SyncStatus, now: Date): string {
  const waiting = [
    ...(status.pending > 0 ? [`${status.pending} ${status.pending === 1 ? "change" : "changes"} waiting to send`] : []),
    ...(status.stuck > 0 ? [`${status.stuck} couldn't be sent`] : []),
  ];
  const headline = (() => {
    switch (status.phase) {
      case "syncing":
        return "Syncing…";
      case "idle":
        return status.lastSyncedAt === null ? "Connected" : formatSyncedAgo(status.lastSyncedAt, now);
      case "offline":
        return "Offline. Your changes will go when the connection is back.";
      case "failed":
        return "The server had a problem. Trying again shortly.";
      case "signedOut":
        return "The server refused this token. Paste a new one.";
      case "unsupported":
        return "This version of the app can no longer send changes. Update it.";
    }
  })();
  return [headline, ...waiting].join(" · ");
}
