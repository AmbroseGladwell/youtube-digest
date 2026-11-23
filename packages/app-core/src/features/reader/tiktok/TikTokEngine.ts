import type { PlaybackPosition, PlaybackSource } from "../../../app/PlaybackContext.js";

export const TIKTOK_PLAYER_ORIGIN = "https://www.tiktok.com";

// docs/features/tiktok-links.md, "The player": TikTok's own message protocol for its v1 embed.
export const tiktokPlayerUrl = (videoId: string): string =>
  `${TIKTOK_PLAYER_ORIGIN}/player/v1/${encodeURIComponent(videoId)}?autoplay=1&rel=0&description=0&music_info=0&native_context_menu=0`;

export type TikTokPlayerStatus = "closed" | "loading" | "ready" | "playing" | "paused" | "failed";

export interface TikTokPlayerSnapshot {
  status: TikTokPlayerStatus;
  positionMs: number;
  durationMs: number | null;
}

export interface TikTokFrame {
  post: (message: object) => void;
}

export interface TikTokEngineOptions {
  playbackId: string;
  durationMs: number | null;
  onStart: () => void;
  // A time pressed once the player has failed opens the clip on TikTok instead (design 130h-3).
  openOutside: () => void;
  setTimer?: (run: () => void, ms: number) => () => void;
}

// TikTok limits embeds per site, so a player that never says it is ready counts as one that won't load.
export const READY_WITHIN_MS = 12_000;

const AUTOPLAY_BLOCKED = 3002;
const PLAYING = 1;
const PAUSED_STATES = new Set([0, 2]);

interface PlayerMessage {
  type: string;
  value: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const parsed = (data: unknown): PlayerMessage | null => {
  let message: unknown = data;
  if (typeof data === "string") {
    try {
      message = JSON.parse(data);
    } catch {
      return null;
    }
  }
  return isRecord(message) && typeof message.type === "string" ? { type: message.type, value: message.value } : null;
};

const defaultTimer = (run: () => void, ms: number) => {
  const id = setTimeout(run, ms);
  return () => clearTimeout(id);
};

// The embed is made only when pressed, so a note that is only read costs TikTok's per-site limit nothing.
export class TikTokEngine {
  readonly #options: TikTokEngineOptions;
  #frame: TikTokFrame | null = null;
  #snapshot: TikTokPlayerSnapshot;
  #position: PlaybackPosition;
  #pendingSeekMs: number | null = null;
  #cancelReadyWait: (() => void) | null = null;
  readonly #listeners = new Set<() => void>();

  constructor(options: TikTokEngineOptions) {
    this.#options = options;
    this.#snapshot = { status: "closed", positionMs: 0, durationMs: options.durationMs };
    this.#position = { videoId: options.playbackId, positionMs: 0, playing: false };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): TikTokPlayerSnapshot => this.#snapshot;

  readonly playback: PlaybackSource = {
    subscribe: this.subscribe,
    getPosition: () => this.#position,
    seekTo: (positionMs) => this.jump(positionMs),
  };

  open(): void {
    if (this.#snapshot.status === "closed") {
      this.#options.onStart();
      this.#set({ status: "loading" });
    }
  }

  attach(frame: TikTokFrame | null): void {
    this.#frame = frame;
    this.#cancelReadyWait?.();
    this.#cancelReadyWait = null;
    if (frame !== null && this.#snapshot.status === "loading") {
      this.#cancelReadyWait = (this.#options.setTimer ?? defaultTimer)(() => this.#fail(), READY_WITHIN_MS);
    }
  }

  receive(data: unknown): void {
    const message = parsed(data);
    if (message === null) {
      return;
    }
    if (message.type === "onPlayerReady") {
      this.#ready();
    } else if (message.type === "onStateChange" && typeof message.value === "number") {
      this.#stateChanged(message.value);
    } else if (message.type === "onCurrentTime" && isRecord(message.value)) {
      this.#timeChanged(message.value);
    } else if (message.type === "onPlayerError") {
      this.#playerError(message.value);
    }
  }

  toggle(): void {
    if (this.#snapshot.status === "playing") {
      this.pause();
    } else {
      this.play();
    }
  }

  play(): void {
    if (this.#snapshot.status === "closed") {
      this.open();
      return;
    }
    this.#options.onStart();
    this.#send("play");
  }

  pause(): void {
    this.#send("pause");
  }

  jump(positionMs: number): void {
    if (this.#snapshot.status === "failed") {
      this.#options.openOutside();
      return;
    }
    this.#set({ positionMs });
    if (this.#snapshot.status === "closed" || this.#snapshot.status === "loading") {
      this.#pendingSeekMs = positionMs;
      this.open();
      return;
    }
    this.#send("seekTo", positionMs / 1000);
    this.play();
  }

  dispose(): void {
    this.#cancelReadyWait?.();
    this.#frame = null;
  }

  #send(type: string, value?: number): void {
    this.#frame?.post({ "x-tiktok-player": true, type, ...(value === undefined ? {} : { value }) });
  }

  #ready(): void {
    this.#cancelReadyWait?.();
    this.#cancelReadyWait = null;
    if (this.#snapshot.status === "loading") {
      this.#set({ status: "ready" });
    }
    if (this.#pendingSeekMs !== null) {
      this.#send("seekTo", this.#pendingSeekMs / 1000);
      this.#pendingSeekMs = null;
    }
    this.#send("play");
  }

  #stateChanged(state: number): void {
    if (state === PLAYING) {
      this.#set({ status: "playing" });
    } else if (PAUSED_STATES.has(state)) {
      this.#set({ status: "paused" });
    }
  }

  #timeChanged({ currentTime, duration }: Record<string, unknown>): void {
    this.#set({
      ...(typeof currentTime === "number" ? { positionMs: currentTime * 1000 } : {}),
      ...(typeof duration === "number" && duration > 0 ? { durationMs: duration * 1000 } : {}),
    });
  }

  // A browser refusing autoplay leaves the player ready for a press inside it, which isn't a failure.
  #playerError(value: unknown): void {
    if (isRecord(value) && value.errorCode === AUTOPLAY_BLOCKED) {
      this.#set({ status: "paused" });
      return;
    }
    this.#fail();
  }

  #fail(): void {
    this.#cancelReadyWait = null;
    this.#pendingSeekMs = null;
    this.#set({ status: "failed" });
  }

  #set(change: Partial<TikTokPlayerSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...change };
    const playing = this.#snapshot.status === "playing";
    if (this.#position.positionMs !== this.#snapshot.positionMs || this.#position.playing !== playing) {
      this.#position = { videoId: this.#options.playbackId, positionMs: this.#snapshot.positionMs, playing };
    }
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
