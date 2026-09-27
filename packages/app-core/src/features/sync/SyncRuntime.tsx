import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createFetchAuthApi,
  createFetchSyncApi,
  INITIAL_SYNC_STATUS,
  SyncEngine,
  type SyncStatus,
} from "@overview/sync";
import { useStores } from "../../stores/StoresContext.js";
import { overviewKeys } from "../overviews/overviewKeys.js";
import { topicKeys } from "../overviews/topicKeys.js";
import { settingsKeys } from "../settings/settingsKeys.js";
import { SyncProvider } from "./SyncContext.js";
import { DEFAULT_SYNC_CONNECTION, useSyncConnection } from "./useSyncConnection.js";
import { isConnected } from "./types/SyncConnection.js";

// Owns the one engine for this tab: built when a server is known, stopped when it goes.
// Sits above the router so a cycle outlives every navigation, and inside the query
// client so a pull can tell every open page to re-read (docs/features/sync-client.md).
export function SyncRuntime({ children }: { children: ReactNode }) {
  const { syncStorage } = useStores();
  const { connection, setConnection } = useSyncConnection();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>(INITIAL_SYNC_STATUS);
  const engine = useRef<SyncEngine | null>(null);
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
    engine.current = started;
    const unsubscribe = started.subscribe(setStatus);
    const stop = started.start();
    return () => {
      stop();
      unsubscribe();
      engine.current = null;
    };
  }, [syncStorage, apiUrl, token, queryClient]);

  const value = useMemo(() => {
    const disconnect = async () => {
      const running = engine.current;
      setConnection(DEFAULT_SYNC_CONNECTION);
      await running?.whenIdle();
      await syncStorage?.leave();
    };
    return {
      available: syncStorage !== null,
      connected,
      status,
      syncNow: () => void engine.current?.sync(),
      disconnect,
      // The server's answer does not decide the outcome: a session the server could not
      // be told about ends on its own, and this device is done with it either way.
      signOut: async () => {
        if (apiUrl !== null) {
          await createFetchAuthApi({ baseUrl: apiUrl, token }).signOut().catch(() => undefined);
        }
        await disconnect();
      },
    };
  }, [syncStorage, connected, status, setConnection, apiUrl, token]);

  return <SyncProvider value={value}>{children}</SyncProvider>;
}
