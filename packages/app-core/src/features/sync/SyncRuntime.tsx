import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { VideoId } from "@overview/domain";
import {
  createFetchAuthApi,
  createFetchSyncApi,
  INITIAL_SYNC_STATUS,
  SyncEngine,
  type SyncStatus,
} from "@overview/sync";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { useStores } from "../../stores/StoresContext.js";
import { overviewKeys } from "../overviews/overviewKeys.js";
import { topicKeys } from "../overviews/topicKeys.js";
import { settingsKeys } from "../settings/settingsKeys.js";
import { SyncProvider } from "./SyncContext.js";
import { DEFAULT_SYNC_CONNECTION, useSyncConnection } from "./useSyncConnection.js";
import { isConnected, libraryAccountIdOf } from "./types/SyncConnection.js";

// Owns the one engine for this tab: built when a server is known, stopped when it goes.
// Sits above the router so a cycle outlives every navigation, and inside the query
// client so a pull can tell every open page to re-read (docs/features/sync-client.md).
export function SyncRuntime({ children }: { children: ReactNode }) {
  const stores = useStores();
  const { connection, setConnection } = useSyncConnection();
  // Never the library being left, mid-switch (docs/features/account-libraries.md).
  const libraryIsTheAccounts = useLibraryAccountId() === libraryAccountIdOf(connection);
  const syncStorage = libraryIsTheAccounts ? stores.syncStorage : null;
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>(INITIAL_SYNC_STATUS);
  const engine = useRef<{ engine: SyncEngine; stop: () => void } | null>(null);
  const connected = syncStorage !== null && isConnected(connection);
  const { apiUrl, token } = connection;

  useEffect(() => {
    if (syncStorage === null || apiUrl === null) {
      setStatus(INITIAL_SYNC_STATUS);
      return;
    }
    const started = new SyncEngine({
      api: createFetchSyncApi({ baseUrl: apiUrl, token }),
      storage: syncStorage,
      onApplied: () => {
        void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
        void queryClient.invalidateQueries({ queryKey: topicKeys.all });
        void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      },
    });
    const unsubscribe = started.subscribe(setStatus);
    const stop = started.start();
    engine.current = { engine: started, stop };
    return () => {
      stop();
      unsubscribe();
      engine.current = null;
    };
  }, [syncStorage, apiUrl, token, queryClient]);

  const value = useMemo(
    () => ({
      available: stores.syncStorage !== null,
      connected,
      status,
      syncNow: () => void engine.current?.engine.sync(),
      fetchTranscript: connected
        ? (videoId: VideoId) => engine.current?.engine.fetchTranscript(videoId) ?? Promise.resolve(null)
        : null,
      // Nothing is cleared, and the server's answer decides nothing (docs/features/account-libraries.md).
      signOut: async () => {
        const running = engine.current;
        running?.stop();
        await running?.engine.whenIdle();
        if (apiUrl !== null) {
          await createFetchAuthApi({ baseUrl: apiUrl, token }).signOut().catch(() => undefined);
        }
        setConnection(DEFAULT_SYNC_CONNECTION);
      },
    }),
    [stores.syncStorage, connected, status, setConnection, apiUrl, token],
  );

  return <SyncProvider value={value}>{children}</SyncProvider>;
}
