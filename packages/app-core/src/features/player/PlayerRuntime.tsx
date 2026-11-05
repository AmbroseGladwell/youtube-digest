import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_NARRATION_VOICE } from "@overview/domain";
import { createFetchNarrationApi } from "@overview/sync";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useSync } from "../sync/SyncContext.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { NarrationApiProvider } from "./NarrationApiContext.js";
import { PlayerEngine } from "./PlayerEngine.js";
import { PlayerProvider } from "./PlayerContext.js";
import { bindMediaSession } from "./util/bindMediaSession.js";
import { useClientSurface } from "../../app/SurfaceContext.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";

// Owns the one player for this tab, above the router so a note keeps playing across
// navigation, and inside the sync runtime because narration needs the account's session
// (docs/features/audio-player.md).
export function PlayerRuntime({ children }: { children: ReactNode }) {
  const { connected } = useSync();
  const { apiUrl, token } = useSyncConnection().connection;
  const surface = useClientSurface();
  const api = useMemo(
    () => (connected && apiUrl !== null ? createFetchNarrationApi({ baseUrl: apiUrl, token, surface }) : null),
    [connected, apiUrl, token, surface],
  );
  const voice = useSettingsQuery().data?.narrationVoice ?? DEFAULT_NARRATION_VOICE;
  const reporter = useErrorReporter();
  const analytics = useAnalytics();
  const latestAnalytics = useRef(analytics);
  latestAnalytics.current = analytics;
  const [engine] = useState(
    () =>
      new PlayerEngine({
        api,
        voice,
        createMedia: () => new Audio(),
        warn: (warning) => reporter.warn(warning),
        onFirstSound: (report) => latestAnalytics.current.player.playback.firstSound(report),
        onListenStarted: (report) => latestAnalytics.current.player.playback.started(report),
        onListenEnded: (report) => latestAnalytics.current.player.playback.ended(report),
      }),
  );

  useEffect(() => {
    const flush = () => void latestAnalytics.current.flush({ keepalive: true });
    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      engine.pageHidden();
      flush();
    };
    const onPageHide = () => {
      engine.pageLeft();
      flush();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    globalThis.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      globalThis.removeEventListener("pagehide", onPageHide);
    };
  }, [engine]);

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
