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

  // Recorded rather than acted on: there is no player here, and what the reader needs
  // to know is that pressing the control asked for the right moment.
  readonly seeks: number[] = [];

  seekTo = (positionMs: number): void => {
    this.seeks.push(positionMs);
  };

  moveTo = (position: PlaybackPosition | null): void => {
    this.position = position;
    for (const listener of this.listeners) listener();
  };
}
