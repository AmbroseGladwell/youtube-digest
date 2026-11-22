import { createContext, useContext, useSyncExternalStore } from "react";

export interface PlaybackPosition {
  videoId: string;
  positionMs: number;
  playing: boolean;
}

export interface PlaybackSource {
  subscribe: (onChange: () => void) => () => void;
  getPosition: () => PlaybackPosition | null;
  // Only ever called because someone pressed something; only an episode in its note honours `untilMs`.
  seekTo: (positionMs: number, untilMs?: number) => void;
}

// Injected because app-core can't read chrome.* to reach the player in the tab beside it.
const PlaybackContext = createContext<PlaybackSource | null>(null);

export const PlaybackProvider = PlaybackContext.Provider;

const subscribeToNothing = () => () => {};
const noPosition = () => null;

export const useCanFollowPlayback = (): boolean => {
  return useContext(PlaybackContext) !== null;
};

export const useSeekPlayback = (videoId: string | null): ((positionMs: number, untilMs?: number) => void) | null => {
  const source = useContext(PlaybackContext);
  const reporting = usePlaybackPosition(videoId) !== null;
  return source !== null && reporting ? source.seekTo : null;
};

export const usePlaybackPosition = (videoId: string | null): PlaybackPosition | null => {
  const source = useContext(PlaybackContext);
  const position = useSyncExternalStore(source?.subscribe ?? subscribeToNothing, source?.getPosition ?? noPosition);
  if (position === null || videoId === null || position.videoId !== videoId) {
    return null;
  }
  return position;
};
