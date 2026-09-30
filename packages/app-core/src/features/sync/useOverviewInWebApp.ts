import type { OverviewId } from "@overview/domain";
import { Routes } from "../../app/Routes.js";
import { useOverviewSyncedQuery } from "./queries/overviewSyncedQuery.js";
import { useSync } from "./SyncContext.js";
import { useSyncConnection } from "./useSyncConnection.js";

// Null where this shell cannot sync at all, so the item hides. Otherwise either the note's
// address in the web app, or why it has none yet.
export type OverviewInWebApp = { href: string } | { reason: string } | null;

// The server a device syncs with also serves the web app (docs/architecture/deploy.md), so
// a note's address there is known once the server holds it (docs/features/extension-panel.md).
export function useOverviewInWebApp(overviewId: OverviewId): OverviewInWebApp {
  const sync = useSync();
  const { connection } = useSyncConnection();
  const synced = useOverviewSyncedQuery(overviewId, sync.connected);

  if (!sync.available) return null;
  if (!sync.connected || connection.apiUrl === null) {
    return { reason: "Sign in to see it in the web app" };
  }
  if (synced.data !== true) {
    return { reason: "Not in the web app until it syncs" };
  }
  return { href: new URL(Routes.overview(overviewId), connection.apiUrl).href };
}
