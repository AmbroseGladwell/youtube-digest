import type { OverviewId } from "@overview/domain";
import { Routes } from "../../app/Routes.js";
import { useOverviewSyncedQuery } from "./queries/overviewSyncedQuery.js";
import { useSync } from "./SyncContext.js";
import { useSyncConnection } from "./useSyncConnection.js";

// Null where this shell cannot sync at all, so the item hides.
export type OverviewInWebApp = { href: string } | { reason: string } | null;

// Why the address waits for the server to hold the note: docs/features/extension-panel.md, "Open in web app".
export const useOverviewInWebApp = (overviewId: OverviewId): OverviewInWebApp => {
  const sync = useSync();
  const { connection } = useSyncConnection();
  const synced = useOverviewSyncedQuery(overviewId, sync.connected);

  if (!sync.available) {
    return null;
  }
  if (!sync.connected || connection.apiUrl === null) {
    return { reason: "Sign in to see it in the web app" };
  }
  if (synced.data !== true) {
    return { reason: "Not in the web app until it syncs" };
  }
  return { href: new URL(Routes.overview(overviewId), connection.apiUrl).href };
};
