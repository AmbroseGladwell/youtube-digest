import { createContext, useContext, useSyncExternalStore } from "react";

export interface PlaybackPosition {
  videoId: string;
  positionMs: number;
  playing: boolean;
}

export interface PlaybackSource {
  subscribe: (onChange: () => void) => () => void;
  getPosition: () => PlaybackPosition | null;
}

// Injected by the shell for the same reason ActiveVideoSource is: app-core cannot read
// chrome.* and has no way to reach the player in the tab next to it
// (docs/features/following-playback.md). A shell that supplies none reports nothing, and
// every affordance built on this is simply absent.
const PlaybackContext = createContext<PlaybackSource | null>(null);

export const PlaybackProvider = PlaybackContext.Provider;

const subscribeToNothing = () => () => {};
const noPosition = () => null;

export function useCanFollowPlayback(): boolean {
  return useContext(PlaybackContext) !== null;
}

// Null for a shell that cannot see the player, for a player that has not reported yet,
// and for a report about a different video than the one being read. Never a number this
// app worked out for itself — the position is measured by the player or it is missing
// (docs/prototype/constraints.md).
export function usePlaybackPosition(videoId: string | null): PlaybackPosition | null {
  const source = useContext(PlaybackContext);
  const position = useSyncExternalStore(
    source?.subscribe ?? subscribeToNothing,
    source?.getPosition ?? noPosition,
  );
  if (position === null || videoId === null || position.videoId !== videoId) {
    return null;
  }
  return position;
}
