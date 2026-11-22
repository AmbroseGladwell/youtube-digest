export interface MediaSessionOverride {
  title: string;
  artist: string;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
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
