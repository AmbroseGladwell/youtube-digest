import type { PlaybackPosition, PlaybackSource } from "../../src/app/PlaybackContext.js";

export class IwftPlaybackSource implements PlaybackSource {
  private readonly listeners = new Set<() => void>();

  constructor(private position: PlaybackPosition | null) {}

  getPosition = (): PlaybackPosition | null => this.position;

  subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  };

  moveTo = (position: PlaybackPosition | null): void => {
    this.position = position;
    for (const listener of this.listeners) listener();
  };
}
