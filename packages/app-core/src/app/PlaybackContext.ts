import { createContext, useContext, useSyncExternalStore } from "react";

export interface PlaybackPosition {
  videoId: string;
  positionMs: number;
  playing: boolean;
}

export interface PlaybackSource {
  subscribe: (onChange: () => void) => () => void;
  getPosition: () => PlaybackPosition | null;
  // The one thing here that writes to the page rather than reading it, and only ever
  // because someone pressed something (docs/features/following-playback.md).
  seekTo: (positionMs: number) => void;
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
// Null unless there is a player to move and it is playing the video being read, which
// is what keeps the control off the web app and off a note about another video.
export function useSeekPlayback(videoId: string | null): ((positionMs: number) => void) | null {
  const source = useContext(PlaybackContext);
  const reporting = usePlaybackPosition(videoId) !== null;
  return source !== null && reporting ? source.seekTo : null;
}

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
