import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_NARRATION_VOICE, NARRATION_FILE_TYPE } from "@overview/domain";
import { createFetchChatApi, type ChatApi } from "@overview/sync";
import { useClientSurface } from "../../../app/SurfaceContext.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { usePlayer } from "../../player/PlayerContext.js";
import { overrideMediaSession } from "../../player/util/mediaSessionOverride.js";
import { usePlan } from "../../plus/usePlan.js";
import { useSettingsQuery } from "../../settings/queries/settingsQuery.js";
import { useSync } from "../../sync/SyncContext.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { chatKeys } from "../chatKeys.js";
import { ReadAloudEngine, type ReadAloudMeta, type ReadAloudReport } from "./ReadAloudEngine.js";
import { ReadAloudProvider } from "./ReadAloudContext.js";

const audioUrlOf = (base64: string): string => {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: NARRATION_FILE_TYPE }));
};

// One player for every chat, inside the narration player: docs/features/chat-read-aloud.md, "The player".
export const ReadAloudRuntime = ({ children }: { children: ReactNode }) => {
  const { connected } = useSync();
  const { apiUrl, token } = useSyncConnection().connection;
  const surface = useClientSurface();
  const narration = usePlayer();
  const analytics = useAnalytics();
  const { plan } = usePlan();
  const queryClient = useQueryClient();
  const voice = useSettingsQuery().data?.narrationVoice ?? DEFAULT_NARRATION_VOICE;
  const api = useMemo<ChatApi | null>(
    () => (connected && apiUrl !== null ? createFetchChatApi({ baseUrl: apiUrl, token, surface }) : null),
    [connected, apiUrl, token, surface],
  );
  const latest = useRef({ api, analytics, plan, voice, queryClient });
  latest.current = { api, analytics, plan, voice, queryClient };

  const [engine] = useState(() => {
    let releaseSession: (() => void) | null = null;
    const report = (report: ReadAloudReport, meta: ReadAloudMeta) => {
      const { analytics: events, plan: current, voice: spoken, queryClient: queries } = latest.current;
      if (report.event === "completed" || report.event === "stopped" || report.event === "failed") {
        void queries.invalidateQueries({ queryKey: [...chatKeys.all, "usage"] });
      }
      const common = { plan: current, scope: meta.scope };
      if (report.event === "refused") {
        events.chat.readAloud.refused({ ...common, quota: report.quota });
        return;
      }
      const props = { ...common, voice: spoken, sentences: report.sentences };
      if (report.event === "started") {
        events.chat.readAloud.started({ ...props, control: report.control, replay: report.replay });
      } else if (report.event === "failed") {
        events.chat.readAloud.failed({ ...props, reason: report.reason });
      } else {
        events.chat.readAloud[report.event](props);
      }
    };
    return new ReadAloudEngine({
      api: () => latest.current.api,
      createMedia: () => new Audio(),
      narration: {
        isPlaying: () => {
          const { status } = narration.getSnapshot();
          return status === "playing" || status === "buffering";
        },
        pause: () => narration.pause(),
        resume: () => narration.play("chatAnswer"),
        subscribe: narration.subscribe,
      },
      audioUrl: audioUrlOf,
      releaseUrl: (url) => URL.revokeObjectURL(url),
      now: () => Date.now(),
      showSession: (session) => {
        releaseSession?.();
        releaseSession =
          session === null
            ? null
            : overrideMediaSession({
                title: session.title,
                artist: session.artist,
                onPlay: session.onPlay,
                onPause: session.onPause,
                onNext: session.onNext,
                onPrevious: session.onPrevious,
                own: { state: session.state, artworkUrl: session.artworkUrl },
              });
      },
      report,
    });
  });

  useEffect(() => {
    if (!connected) {
      engine.stop();
    }
  }, [engine, connected]);
  useEffect(() => {
    const leave = () => engine.stop();
    globalThis.addEventListener("pagehide", leave);
    return () => {
      globalThis.removeEventListener("pagehide", leave);
      engine.stop();
    };
  }, [engine]);

  return <ReadAloudProvider value={api === null ? null : engine}>{children}</ReadAloudProvider>;
};
