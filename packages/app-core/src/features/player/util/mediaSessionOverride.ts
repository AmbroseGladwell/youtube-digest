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

export function onMediaSessionOverride(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Cooking step by step gives the headphone and lock-screen buttons other meanings while it is
// open (design 150u); the player's own come back when it closes.
export function overrideMediaSession(override: MediaSessionOverride): () => void {
  current = override;
  listeners.forEach((listener) => listener());
  return () => {
    if (current !== override) return;
    current = null;
    listeners.forEach((listener) => listener());
  };
}
