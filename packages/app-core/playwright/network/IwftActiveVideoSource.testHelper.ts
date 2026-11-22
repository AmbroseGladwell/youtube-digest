import type { ActiveVideoSource } from "../../src/app/ActiveVideoContext.js";

export class IwftActiveVideoSource implements ActiveVideoSource {
  private readonly listeners = new Set<() => void>();

  private videoUrl: string | null;

  constructor(videoUrl: string | null) {
    this.videoUrl = videoUrl;
  }

  getVideoUrl = (): string | null => this.videoUrl;

  subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  };

  watchAnother = (videoUrl: string | null): void => {
    this.videoUrl = videoUrl;
    for (const listener of this.listeners) {
      listener();
    }
  };
}
