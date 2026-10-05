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
import { forgetSignedOutHere, rememberSignedOutHere } from "../accountLibraries/useDeviceAccountHistory.js";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { useStores } from "../../stores/StoresContext.js";
import { overviewKeys } from "../overviews/overviewKeys.js";
import { topicKeys } from "../overviews/topicKeys.js";
import { settingsKeys } from "../settings/settingsKeys.js";
import { SyncProvider } from "./SyncContext.js";
import { readSyncConnection } from "./syncConnectionStorage.js";
import { DEFAULT_SYNC_CONNECTION, useSyncConnection } from "./useSyncConnection.js";
import type { SignOutNotice } from "./types/SignOutNotice.js";
import { isConnected, libraryAccountIdOf } from "./types/SyncConnection.js";
import type { SignOutOptions, SignOutOutcome } from "./types/SignOutOutcome.js";
import { signOutNoticeFor } from "./util/signOutNoticeFor.js";
import { signOutOutcomeOf } from "./util/signOutOutcomeOf.js";
import { useClientSurface } from "../../app/SurfaceContext.js";
import { playlistKeys } from "../playlists/playlistKeys.js";
import { captureQueueKeys } from "../captureQueue/captureQueueKeys.js";

// How long sign-out waits for its last cycle before going anyway: it always completes.
const SIGN_OUT_SYNC_LIMIT_MS = 10_000;

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
  const [signingOut, setSigningOut] = useState(false);
  const [signOutNotice, setSignOutNotice] = useState<SignOutNotice | null>(null);
  const [opening, setOpening] = useState(false);
  const wasConnected = useRef(connected);
  const surface = useClientSurface();

  useEffect(() => {
    const signedIn = connected && !wasConnected.current;
    wasConnected.current = connected;
    if (!signedIn) return;
    forgetSignedOutHere();
    setSignOutNotice(null);
    setOpening(true);
  }, [connected]);

  useEffect(() => {
    if (syncStorage === null || apiUrl === null) {
      setStatus(INITIAL_SYNC_STATUS);
      setOpening(false);
      return;
    }
    const started = new SyncEngine({
      api: createFetchSyncApi({ baseUrl: apiUrl, token, surface }),
      storage: syncStorage,
      onApplied: () => {
        void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
        void queryClient.invalidateQueries({ queryKey: topicKeys.all });
        void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
        void queryClient.invalidateQueries({ queryKey: playlistKeys.all });
        void queryClient.invalidateQueries({ queryKey: captureQueueKeys.all });
      },
    });
    const unsubscribe = started.subscribe(setStatus);
    const stop = started.start();
    engine.current = { engine: started, stop };
    void started.whenIdle().then(() => setOpening(false));
    return () => {
      stop();
      unsubscribe();
      engine.current = null;
    };
  }, [syncStorage, apiUrl, token, surface, queryClient]);

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
      signingOut,
      signOutNotice,
      dismissSignOutNotice: () => setSignOutNotice(null),
      opening: opening && connected,
      signOut: async ({ beforeEndingSession }: SignOutOptions = {}) => {
        const running = engine.current;
        setSigningOut(true);
        try {
          const online = globalThis.navigator?.onLine ?? true;
          const outcome: SignOutOutcome =
            running === null
              ? { pending: 0, stuck: 0, offline: !online, timedOut: false }
              : await lastCycleBeforeSigningOut(running.engine, online);
          running?.stop();
          await beforeEndingSession?.(outcome).catch(() => undefined);
          if (apiUrl !== null) {
            await createFetchAuthApi({ baseUrl: apiUrl, token, surface }).signOut().catch(() => undefined);
          }
          const stillThisConnection = readSyncConnection().accountId === connection.accountId;
          if (stillThisConnection) {
            rememberSignedOutHere();
            setSignOutNotice(signOutNoticeFor(outcome));
            setConnection(DEFAULT_SYNC_CONNECTION);
          }
        } finally {
          setSigningOut(false);
        }
      },
    }),
    [stores.syncStorage, connected, status, connection, setConnection, apiUrl, token, surface, signingOut, signOutNotice, opening],
  );

  return <SyncProvider value={value}>{children}</SyncProvider>;
}

// One cycle, so whatever was waiting goes before the session does; a cycle that hangs is
// given up on rather than holding the reader signed in (docs/features/account-libraries.md).
async function lastCycleBeforeSigningOut(engine: SyncEngine, online: boolean): Promise<SignOutOutcome> {
  const limit = new Promise<null>((resolve) => setTimeout(() => resolve(null), SIGN_OUT_SYNC_LIMIT_MS));
  const finished = await Promise.race([engine.sync().catch(() => engine.status), limit]);
  return signOutOutcomeOf(finished ?? engine.status, { online, timedOut: finished === null });
}
