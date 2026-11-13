import { useEffect, useMemo, useSyncExternalStore } from "react";
import { sourceKey, type Source } from "@overview/domain";
import { usePlayer } from "../../player/PlayerContext.js";
import { EpisodeEngine, type EpisodeSnapshot } from "./EpisodeEngine.js";

const NO_EPISODE: EpisodeSnapshot = { status: "idle", positionMs: 0, durationMs: null, jumps: 0 };
const subscribeToNothing = () => () => {};

// The episode's player for an episode's note, or null for any other. One sound at a time:
// starting the episode pauses the narration where it was, and the narration starting pauses
// the episode (design 106q-2). Leaving the note stops the episode.
export function useEpisodeEngine(source: Source | null): EpisodeEngine | null {
  const narration = usePlayer();
  const audioUrl = source?.kind === "podcast" ? source.audioUrl : null;
  const playbackId = source?.kind === "podcast" ? sourceKey(source) : null;
  const engine = useMemo(
    () =>
      audioUrl === null || playbackId === null
        ? null
        : new EpisodeEngine({
            audioUrl,
            playbackId,
            createMedia: () => new Audio(),
            onStart: () => {
              const { status } = narration.getSnapshot();
              if (status === "playing" || status === "buffering") narration.pause();
            },
          }),
    [audioUrl, playbackId, narration],
  );

  useEffect(() => {
    if (engine === null) return;
    const stop = narration.subscribe(() => {
      if (narration.getSnapshot().status === "playing" && engine.getSnapshot().status === "playing") engine.pause();
    });
    return () => {
      stop();
      engine.dispose();
    };
  }, [engine, narration]);

  return engine;
}

export function useEpisodeSnapshot(engine: EpisodeEngine | null): EpisodeSnapshot {
  return useSyncExternalStore(engine?.subscribe ?? subscribeToNothing, engine?.getSnapshot ?? (() => NO_EPISODE));
}
