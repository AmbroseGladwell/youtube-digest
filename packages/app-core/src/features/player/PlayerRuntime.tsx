import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFetchNarrationApi } from "@overview/sync";
import { useSync } from "../sync/SyncContext.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { PlayerEngine } from "./PlayerEngine.js";
import { PlayerProvider } from "./PlayerContext.js";
import { bindMediaSession } from "./util/bindMediaSession.js";

// Owns the one player for this tab, above the router so a note keeps playing across
// navigation, and inside the sync runtime because narration needs the account's session
// (docs/features/audio-player.md).
export function PlayerRuntime({ children }: { children: ReactNode }) {
  const { connected } = useSync();
  const { apiUrl, token } = useSyncConnection().connection;
  const api = useMemo(
    () => (connected && apiUrl !== null ? createFetchNarrationApi({ baseUrl: apiUrl, token }) : null),
    [connected, apiUrl, token],
  );
  const [engine] = useState(() => new PlayerEngine({ api, createMedia: () => new Audio() }));

  useEffect(() => engine.setApi(api), [engine, api]);
  useEffect(() => bindMediaSession(engine), [engine]);
  useEffect(() => () => engine.stop(), [engine]);

  return <PlayerProvider value={engine}>{children}</PlayerProvider>;
}
