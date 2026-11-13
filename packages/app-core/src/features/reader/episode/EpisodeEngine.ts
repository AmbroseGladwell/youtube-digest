import type { PlaybackPosition, PlaybackSource } from "../../../app/PlaybackContext.js";

export type EpisodeMedia = Pick<
  HTMLAudioElement,
  "src" | "currentTime" | "duration" | "paused" | "play" | "pause" | "addEventListener" | "removeAttribute" | "load" | "preload"
>;

export type EpisodeStatus = "idle" | "loading" | "playing" | "paused" | "failed";

export interface EpisodeSnapshot {
  status: EpisodeStatus;
  // Always the audio element's own clock, never worked out (docs/prototype/constraints.md).
  positionMs: number;
  // The served file's length once the element knows it, which can differ from the feed's.
  durationMs: number | null;
  // Counts the times a time in the note moved the player, for the line that follows a jump.
  jumps: number;
}

export interface EpisodeEngineOptions {
  audioUrl: string;
  // The id the note's times are matched against: the episode's source key.
  playbackId: string;
  createMedia: () => EpisodeMedia;
  // Called as the episode starts, so the narration can step aside: one sound at a time (106q).
  onStart: () => void;
}

export const BACK_SECONDS = 15;
export const FORWARD_SECONDS = 30;

// The episode's own audio, inside its note (design 106p). One element, made on first play
// so a note that is only read costs the show's host nothing.
export class EpisodeEngine {
  readonly #options: EpisodeEngineOptions;
  #media: EpisodeMedia | null = null;
  #snapshot: EpisodeSnapshot = { status: "idle", positionMs: 0, durationMs: null, jumps: 0 };
  #position: PlaybackPosition;
  #stopAtMs: number | null = null;
  readonly #listeners = new Set<() => void>();

  constructor(options: EpisodeEngineOptions) {
    this.#options = options;
    this.#position = { videoId: options.playbackId, positionMs: 0, playing: false };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): EpisodeSnapshot => this.#snapshot;

  // What the note's times, transcript and chapters follow and move, as they do a video beside
  // the panel (docs/features/following-playback.md).
  readonly playback: PlaybackSource = {
    subscribe: this.subscribe,
    getPosition: () => this.#position,
    seekTo: (positionMs, untilMs) => this.jump(positionMs, untilMs ?? null),
  };

  toggle(): void {
    if (this.#snapshot.status === "playing") this.pause();
    else this.play();
  }

  play(): void {
    const media = this.#ensureMedia();
    this.#options.onStart();
    if (this.#snapshot.status === "idle" || this.#snapshot.status === "failed") this.#set({ status: "loading" });
    media.play().catch(() => this.#set({ status: "failed" }));
  }

  pause(): void {
    this.#stopAtMs = null;
    this.#media?.pause();
  }

  // The skips and the scrubber move the player without counting as a jump.
  skip(deltaSeconds: number): void {
    const media = this.#ensureMedia();
    this.seek(Math.max(0, media.currentTime + deltaSeconds) * 1000);
  }

  seek(positionMs: number): void {
    const media = this.#ensureMedia();
    media.currentTime = positionMs / 1000;
    this.#set({ positionMs });
  }

  // A time in the note: play from there, and up to `untilMs` for a range (106s).
  jump(positionMs: number, untilMs: number | null = null): void {
    this.seek(positionMs);
    this.#stopAtMs = untilMs;
    this.#set({ jumps: this.#snapshot.jumps + 1 });
    this.play();
  }

  // Leaving the overview stops the episode (owner, 13 Nov 2026, for now).
  dispose(): void {
    const media = this.#media;
    if (media === null) return;
    media.pause();
    media.removeAttribute("src");
    media.load();
    this.#media = null;
  }

  #ensureMedia(): EpisodeMedia {
    if (this.#media !== null) return this.#media;
    const media = this.#options.createMedia();
    media.preload = "metadata";
    media.addEventListener("playing", () => this.#set({ status: "playing" }));
    media.addEventListener("pause", () => this.#set({ status: "paused" }));
    media.addEventListener("ended", () => this.#set({ status: "paused" }));
    media.addEventListener("error", () => this.#set({ status: "failed" }));
    media.addEventListener("loadedmetadata", () =>
      this.#set({ durationMs: Number.isFinite(media.duration) ? media.duration * 1000 : null }),
    );
    media.addEventListener("timeupdate", () => {
      const positionMs = media.currentTime * 1000;
      if (this.#stopAtMs !== null && positionMs >= this.#stopAtMs) this.pause();
      this.#set({ positionMs });
    });
    media.src = this.#options.audioUrl;
    this.#media = media;
    return media;
  }

  #set(change: Partial<EpisodeSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...change };
    const playing = this.#snapshot.status === "playing";
    if (this.#position.positionMs !== this.#snapshot.positionMs || this.#position.playing !== playing) {
      this.#position = { videoId: this.#options.playbackId, positionMs: this.#snapshot.positionMs, playing };
    }
    for (const listener of this.#listeners) listener();
  }
}
