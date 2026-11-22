import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import type { PlayerEngine } from "./PlayerEngine.js";
import type { PlayerSnapshot } from "./types/PlayerSnapshot.js";

// Why two subscriptions, split by frequency: docs/features/audio-player.md, "Where it lives".
const PlayerContext = createContext<PlayerEngine | null>(null);

export const PlayerProvider = PlayerContext.Provider;

export const usePlayer = (): PlayerEngine => {
  const engine = useContext(PlayerContext);
  if (engine === null) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return engine;
};

export const usePlayerSnapshot = (): PlayerSnapshot => {
  const engine = usePlayer();
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot);
};

export const usePlayerTime = (): number => {
  const engine = usePlayer();
  return useSyncExternalStore(engine.subscribeTime, engine.getTime);
};

export const usePlayerLine = (): number => {
  const engine = usePlayer();
  const subscribe = useCallback(
    (onChange: () => void) => {
      const stopTime = engine.subscribeTime(onChange);
      const stopState = engine.subscribe(onChange);
      return () => {
        stopTime();
        stopState();
      };
    },
    [engine],
  );
  return useSyncExternalStore(subscribe, engine.getLine);
};
