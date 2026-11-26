export interface MediaSessionOverride {
  title: string;
  artist: string;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  // A chat answer read aloud owns the lock screen with no narration loaded (OV-418).
  own?: { state: "playing" | "paused"; artworkUrl: string | null };
}

let current: MediaSessionOverride | null = null;
const listeners = new Set<() => void>();

export const currentMediaSessionOverride = (): MediaSessionOverride | null => current;

export const onMediaSessionOverride = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const overrideMediaSession = (override: MediaSessionOverride): (() => void) => {
  current = override;
  listeners.forEach((listener) => listener());
  return () => {
    if (current !== override) {
      return;
    }
    current = null;
    listeners.forEach((listener) => listener());
  };
};
