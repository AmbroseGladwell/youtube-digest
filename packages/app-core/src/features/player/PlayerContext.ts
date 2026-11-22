import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import type { PlayerEngine } from "./PlayerEngine.js";
import type { PlayerSnapshot } from "./types/PlayerSnapshot.js";

// The app's one player, provided above the router (PlayerRuntime). Two subscriptions, split
// by how often they change (frontend-architecture-guide.md 4.2): the state a few times a
// note, the clock several times a second.
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

// The spoken line, which moves far less often than the clock: a component that only
// tints a line re-renders when the line changes, not on every tick.
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
