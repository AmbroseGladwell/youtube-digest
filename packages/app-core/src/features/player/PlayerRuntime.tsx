import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_NARRATION_VOICE } from "@overview/domain";
import { createFetchNarrationApi } from "@overview/sync";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useSync } from "../sync/SyncContext.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { NarrationApiProvider } from "./NarrationApiContext.js";
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
  const voice = useSettingsQuery().data?.narrationVoice ?? DEFAULT_NARRATION_VOICE;
  const [engine] = useState(() => new PlayerEngine({ api, voice, createMedia: () => new Audio() }));

  useEffect(() => engine.setApi(api), [engine, api]);
  useEffect(() => engine.setVoice(voice), [engine, voice]);
  useEffect(() => bindMediaSession(engine), [engine]);
  useEffect(() => () => engine.stop(), [engine]);

  return (
    <PlayerProvider value={engine}>
      <NarrationApiProvider value={api}>{children}</NarrationApiProvider>
    </PlayerProvider>
  );
}
