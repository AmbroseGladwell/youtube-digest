import { useEffect, useMemo, useSyncExternalStore } from "react";
import { sourceKey, type Source } from "@overview/domain";
import { usePlayer } from "../../player/PlayerContext.js";
import { TikTokEngine, type TikTokPlayerSnapshot } from "./TikTokEngine.js";

const NO_PLAYER: TikTokPlayerSnapshot = { status: "closed", positionMs: 0, durationMs: null };
const subscribeToNothing = () => () => {};

// The note's narration and the clip never talk over each other, as with an episode.
export const useTikTokEngine = (source: Source | null): TikTokEngine | null => {
  const narration = usePlayer();
  const tiktok = source?.kind === "tiktok" ? source : null;
  const playbackId = tiktok === null ? null : sourceKey(tiktok);
  const url = tiktok?.url ?? null;
  const durationMs = tiktok?.durationMs ?? null;
  const engine = useMemo(
    () =>
      playbackId === null || url === null
        ? null
        : new TikTokEngine({
            playbackId,
            durationMs,
            onStart: () => {
              const { status } = narration.getSnapshot();
              if (status === "playing" || status === "buffering") {
                narration.pause();
              }
            },
            openOutside: () => void window.open(url, "_blank", "noopener"),
          }),
    [playbackId, url, durationMs, narration],
  );

  useEffect(() => {
    if (engine === null) {
      return;
    }
    const stop = narration.subscribe(() => {
      if (narration.getSnapshot().status === "playing" && engine.getSnapshot().status === "playing") {
        engine.pause();
      }
    });
    return () => {
      stop();
      engine.dispose();
    };
  }, [engine, narration]);

  return engine;
};

export const useTikTokSnapshot = (engine: TikTokEngine | null): TikTokPlayerSnapshot =>
  useSyncExternalStore(engine?.subscribe ?? subscribeToNothing, engine?.getSnapshot ?? (() => NO_PLAYER));
