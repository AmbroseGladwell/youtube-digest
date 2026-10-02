import {
  DEFAULT_NARRATION_VOICE,
  spokenLines,
  type NarrationRender,
  type NarrationVoice,
  type ReadyNarration,
} from "@overview/domain";
import { isSyncRequestError, type NarrationApi, type VoicedNarration } from "@overview/sync";
import type {
  PacerReason,
  PlayerSnapshot,
  PlayerStatus,
} from "./types/PlayerSnapshot.js";
import type { PlayerTrack } from "./types/PlayerTrack.js";
import { estimatedLineStarts, type LineTimings } from "./util/estimatedLineStarts.js";
import { lineAtTime } from "./util/lineAtTime.js";
import { silentWavDataUri } from "./util/silentWavDataUri.js";

export const PLAYER_RATES = [1, 1.25, 1.5, 2];
export const SKIP_SECONDS = 15;
export const POLL_INTERVAL_MS = 1500;
export const WATCH_INTERVAL_MS = 5000;
export const WATCH_GIVES_UP_AFTER_MS = 120_000;
export const PREPARING_LONG_AFTER_MS = 45_000;
export const PACER_TICK_MS = 250;
const POLL_FAILURES_BEFORE_GIVING_UP = 3;

export type PlayerMedia = Pick<
  HTMLMediaElement,
  "src" | "currentTime" | "playbackRate" | "paused" | "play" | "pause" | "addEventListener" | "preload"
>;

export interface PlayerEngineOptions {
  api: NarrationApi | null;
  createMedia: () => PlayerMedia;
  voice?: NarrationVoice;
}

const IDLE: PlayerSnapshot = {
  track: null,
  status: "ready",
  source: "pacer",
  pacerReason: null,
  availability: "checking",
  preparing: null,
  timings: { lineStarts: [], durationSeconds: 0 },
  rate: 1,
  voice: DEFAULT_NARRATION_VOICE,
  narratedVoice: null,
};

const scriptOf = (track: PlayerTrack) => spokenLines(track.lines);

const sameTrack = (a: PlayerTrack | null, b: PlayerTrack) => {
  if (a === null || a.overviewId !== b.overviewId || a.lines.length !== b.lines.length) return false;
  const aScript = scriptOf(a);
  const bScript = scriptOf(b);
  return a.lines.every((line, index) => line.text === b.lines[index]!.text && aScript[index] === bScript[index]);
};

// The one player for the whole app: narrated audio when there is some, the pacer when
// there is not, and the states between (docs/features/audio-player.md). It lives above the
// router so leaving a note does not stop it.
export class PlayerEngine {
  #api: NarrationApi | null;
  #createMedia: () => PlayerMedia;
  #media: PlayerMedia | null = null;
  #mediaSrc: string | null = null;
  #unlocked = false;
  #snapshot: PlayerSnapshot;
  #time = 0;
  #render: ReadyNarration | null = null;
  #replacing: string | null = null;
  #generation = 0;
  #pollTimer: ReturnType<typeof setTimeout> | null = null;
  #longTimer: ReturnType<typeof setTimeout> | null = null;
  #pacerTimer: ReturnType<typeof setInterval> | null = null;
  #pollFailures = 0;
  #watchChecks = 0;
  #listeners = new Set<() => void>();
  #timeListeners = new Set<() => void>();

  constructor({ api, createMedia, voice = DEFAULT_NARRATION_VOICE }: PlayerEngineOptions) {
    this.#api = api;
    this.#createMedia = createMedia;
    this.#snapshot = { ...IDLE, voice };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  subscribeTime = (listener: () => void): (() => void) => {
    this.#timeListeners.add(listener);
    return () => this.#timeListeners.delete(listener);
  };

  getSnapshot = (): PlayerSnapshot => this.#snapshot;
  getTime = (): number => this.#time;
  getLine = (): number => lineAtTime(this.#snapshot.timings.lineStarts, this.#time);
  canNarrate = (): boolean => this.#api !== null;

  // A shell that signs in or out mid-note hands over a new API; a note nobody has pressed
  // play on yet is looked at again with it.
  setApi(api: NarrationApi | null): void {
    if (api === this.#api) return;
    this.#api = api;
    const { track, status } = this.#snapshot;
    const pacerAtRest = this.#snapshot.source === "pacer" && status !== "playing";
    if (track !== null && (status === "ready" || pacerAtRest)) {
      const line = this.getLine();
      this.#teardown();
      this.#begin(track, line);
    }
  }

  // The reader chose another voice. A note nobody has pressed play on is looked at again,
  // so the bar can offer to re-record it; one already under way carries on as it is.
  setVoice(voice: NarrationVoice): void {
    if (voice === this.#snapshot.voice) return;
    this.#set({ voice });
    const { track, status, source } = this.#snapshot;
    if (track !== null && status === "ready" && source === "audio" && this.#api !== null) {
      const line = this.getLine();
      this.#teardown();
      this.#begin(track, line);
    }
  }

  // Design 43j: the note in the reader's chosen voice, from the line they had reached, and
  // only once it has landed is the narration in the older voice thrown away.
  reRecord(): void {
    const { track, narratedVoice, voice, status } = this.#snapshot;
    if (track === null || narratedVoice === null || narratedVoice === voice || status === "preparing") return;
    if (status === "playing" || status === "buffering") this.pause();
    if (status === "ended") this.#time = 0;
    this.#replacing = this.#render?.key ?? null;
    this.#requestRender();
  }

  load(track: PlayerTrack, startLine = 0): void {
    if (sameTrack(this.#snapshot.track, track)) return;
    this.#teardown();
    this.#begin(track, startLine);
  }

  stop(): void {
    this.#teardown();
    this.#time = 0;
    this.#set({ ...IDLE, rate: this.#snapshot.rate, voice: this.#snapshot.voice });
    this.#emitTime();
  }

  toggle(): void {
    const { status } = this.#snapshot;
    if (status === "playing" || status === "buffering") this.pause();
    else if (status === "preparing") this.cancel();
    else this.play();
  }

  play(): void {
    const { track, status, source } = this.#snapshot;
    if (track === null || status === "playing" || status === "preparing") return;
    if (status === "ended") this.#time = 0;
    if (status === "failed" || status === "busy") {
      this.#requestRender();
      return;
    }
    if (source === "pacer") {
      this.#startPacer();
      return;
    }
    if (this.#render !== null) {
      this.#playMedia();
      return;
    }
    this.#requestRender();
  }

  pause(): void {
    const { status, source } = this.#snapshot;
    if (status !== "playing" && status !== "buffering") return;
    if (source === "pacer") this.#stopPacer();
    else this.#media?.pause();
    this.#set({ status: "paused" });
  }

  // The render carries on without anyone waiting for it, so the bar goes back to saying
  // what the server has, which is usually that it is still on its way.
  cancel(): void {
    if (this.#snapshot.status !== "preparing") return;
    this.#generation += 1;
    this.#replacing = null;
    this.#clearPreparing();
    this.#set({ status: "ready", preparing: null });
    if (this.#api !== null && this.#snapshot.source === "audio") this.#peek(true);
  }

  // The pacer, chosen: meanwhile while audio is still being made (1d), instead once it has
  // failed (1i) or there was no room to ask (1j).
  readAlong(): void {
    const { status, track } = this.#snapshot;
    if (track === null) return;
    const meanwhile = status === "preparing";
    const line = this.getLine();
    if (!meanwhile) {
      this.#generation += 1;
      this.#clearPreparing();
    }
    this.#usePacerTimings(line);
    this.#set({
      source: "pacer",
      pacerReason: meanwhile ? "meanwhile" : "chosen",
      preparing: meanwhile ? this.#snapshot.preparing : null,
    });
    this.#startPacer();
  }

  seek(seconds: number): void {
    const { track, timings, status } = this.#snapshot;
    if (track === null) return;
    this.#time = Math.min(Math.max(seconds, 0), timings.durationSeconds);
    if (this.#mediaIsCurrent()) this.#media!.currentTime = this.#time;
    if (status === "ended") this.#set({ status: "paused" });
    this.#emitTime();
  }

  seekLine(index: number): void {
    const { lineStarts } = this.#snapshot.timings;
    const clamped = Math.min(Math.max(index, 0), Math.max(lineStarts.length - 1, 0));
    this.seek(lineStarts[clamped] ?? 0);
  }

  stepLine(delta: number): void {
    this.seekLine(this.getLine() + delta);
  }

  skip(deltaSeconds: number): void {
    this.seek(this.#time + deltaSeconds);
  }

  cycleRate(): void {
    const next = PLAYER_RATES[(PLAYER_RATES.indexOf(this.#snapshot.rate) + 1) % PLAYER_RATES.length]!;
    if (this.#media !== null) this.#media.playbackRate = next;
    this.#set({ rate: next });
  }

  // A note that has just been made asks for its narration straight away, behind anything
  // somebody is waiting to hear, so its first play finds it ready. Nothing waits on the
  // answer and nothing about the player changes, whatever it is.
  prepare(track: PlayerTrack): void {
    this.#api?.request(scriptOf(track), this.#snapshot.voice, "background").catch(() => undefined);
  }

  #begin(track: PlayerTrack, startLine: number): void {
    const timings = estimatedLineStarts(track.lines);
    this.#render = null;
    this.#time = timings.lineStarts[startLine] ?? 0;
    const signedIn = this.#api !== null;
    this.#set({
      track,
      status: "ready",
      source: signedIn ? "audio" : "pacer",
      pacerReason: signedIn ? null : "signedOut",
      availability: signedIn ? "checking" : "onFirstPlay",
      preparing: null,
      timings,
      narratedVoice: null,
    });
    this.#emitTime();
    if (signedIn) this.#peek();
  }

  // After a cancel the bar already knows the audio can be asked for, so a peek that fails
  // there leaves it at 1b rather than declaring narration unavailable.
  #peek(quiet = false): void {
    const api = this.#api!;
    const generation = this.#generation;
    this.#watchChecks = 0;
    api
      .peek(this.#script(), this.#snapshot.voice)
      .then((found) => {
        if (generation !== this.#generation) return;
        this.#pollFailures = 0;
        this.#onPeeked(found, generation);
      })
      .catch((error: unknown) => {
        if (generation !== this.#generation) return;
        const reason = this.#pacerReasonFor(error);
        if (quiet && reason !== "signedOut") {
          this.#set({ availability: "onFirstPlay", preparing: null });
          return;
        }
        this.#fallBackToPacer(reason, false);
      });
  }

  // A render somebody else asked for, usually the note's own background request (OV-41):
  // watched slowly, because nobody is waiting, and landing without playing.
  #onPeeked(found: VoicedNarration | null, generation: number): void {
    const render = found?.render ?? null;
    if (render?.status === "queued" || render?.status === "rendering") {
      if (this.#watchChecks * WATCH_INTERVAL_MS >= WATCH_GIVES_UP_AFTER_MS) {
        this.#set({ availability: "onFirstPlay", preparing: null });
        return;
      }
      this.#set({ availability: "preparing", preparing: { step: render.status, long: false } });
      this.#pollTimer = setTimeout(() => this.#watch(found!, generation), WATCH_INTERVAL_MS);
      return;
    }
    if (render?.status === "ready" && this.#adopt(render)) {
      this.#set({ availability: "ready", preparing: null, narratedVoice: found!.voice });
      return;
    }
    if (this.#snapshot.availability !== "ready") this.#set({ availability: "onFirstPlay", preparing: null });
  }

  // Unlike an interactive wait, checks that fail are not a failure anybody sees: after a few,
  // or after two minutes of the render not landing, the bar goes back to 1b, and pressing
  // play asks again.
  #watch({ voice, render: watched }: VoicedNarration, generation: number): void {
    if (generation !== this.#generation || this.#api === null) return;
    this.#watchChecks += 1;
    this.#api
      .status(watched.key)
      .then((render) => {
        if (generation !== this.#generation) return;
        this.#pollFailures = 0;
        this.#onPeeked({ voice, render }, generation);
      })
      .catch((error: unknown) => {
        if (generation !== this.#generation) return;
        if (isSyncRequestError(error) && error.code === "unauthenticated") {
          this.#fallBackToPacer("signedOut", false);
          return;
        }
        this.#pollFailures += 1;
        if (this.#pollFailures >= POLL_FAILURES_BEFORE_GIVING_UP) {
          this.#set({ availability: "onFirstPlay", preparing: null });
          return;
        }
        this.#pollTimer = setTimeout(() => this.#watch({ voice, render: watched }, generation), WATCH_INTERVAL_MS);
      });
  }

  #requestRender(): void {
    const api = this.#api;
    if (api === null) {
      this.#fallBackToPacer("signedOut", true);
      return;
    }
    this.#unlockMedia();
    this.#generation += 1;
    const generation = this.#generation;
    this.#pollFailures = 0;
    this.#clearPreparing();
    this.#longTimer = setTimeout(() => {
      const { preparing } = this.#snapshot;
      if (generation === this.#generation && preparing !== null) {
        this.#set({ preparing: { ...preparing, long: true } });
      }
    }, PREPARING_LONG_AFTER_MS);
    this.#set({ status: "preparing", preparing: { step: "queued", long: false } });
    const { voice } = this.#snapshot;
    api
      .request(this.#script(), voice, "interactive")
      .then((render) => this.#onRender(render, generation, voice))
      .catch((error: unknown) => {
        if (generation !== this.#generation) return;
        this.#replacing = null;
        this.#clearPreparing();
        if (isSyncRequestError(error) && error.code === "too_many_requests") {
          this.#set({ status: "busy", preparing: null });
          return;
        }
        this.#fallBackToPacer(this.#pacerReasonFor(error), true);
      });
  }

  #onRender(render: NarrationRender, generation: number, voice: NarrationVoice): void {
    if (generation !== this.#generation) return;
    this.#pollFailures = 0;
    if (render.status === "queued" || render.status === "rendering") {
      const { preparing } = this.#snapshot;
      this.#set({ preparing: { step: render.status, long: preparing?.long ?? false } });
      this.#pollTimer = setTimeout(() => this.#poll(render.key, generation, voice), POLL_INTERVAL_MS);
      return;
    }
    this.#clearPreparing();
    if (render.status === "failed") {
      this.#renderGaveUp();
      return;
    }
    const readingAlong = this.#snapshot.source === "pacer";
    const pacerWasPlaying = readingAlong && this.#snapshot.status === "playing";
    const line = this.getLine();
    this.#stopPacer();
    if (!this.#adopt(render, line)) {
      this.#fallBackToPacer("unavailable", pacerWasPlaying || !readingAlong);
      return;
    }
    this.#set({ source: "audio", pacerReason: null, preparing: null, availability: "ready", narratedVoice: voice });
    this.#discardReplaced(render.key);
    if (readingAlong && !pacerWasPlaying) {
      this.#set({ status: "paused" });
      this.#loadMedia();
      return;
    }
    this.#playMedia();
  }

  #poll(key: string, generation: number, voice: NarrationVoice): void {
    if (generation !== this.#generation || this.#api === null) return;
    this.#api
      .status(key)
      .then((render) => this.#onRender(render, generation, voice))
      .catch((error: unknown) => {
        if (generation !== this.#generation) return;
        if (isSyncRequestError(error) && error.code === "unauthenticated") {
          this.#clearPreparing();
          this.#fallBackToPacer("signedOut", true);
          return;
        }
        this.#pollFailures += 1;
        if (this.#pollFailures >= POLL_FAILURES_BEFORE_GIVING_UP) {
          this.#clearPreparing();
          this.#renderGaveUp();
          return;
        }
        this.#pollTimer = setTimeout(() => this.#poll(key, generation, voice), POLL_INTERVAL_MS * 2);
      });
  }

  #discardReplaced(key: string): void {
    const replaced = this.#replacing;
    this.#replacing = null;
    if (replaced !== null && replaced !== key) this.#api?.discard(replaced).catch(() => undefined);
  }

  #renderGaveUp(): void {
    this.#replacing = null;
    if (this.#snapshot.source === "pacer") {
      this.#set({ pacerReason: "unavailable", preparing: null });
      return;
    }
    this.#set({ status: "failed", preparing: null });
  }

  // False when the render does not describe these lines, which would put the highlight on
  // the wrong sentence: better the pacer, marked as such, than that.
  #adopt(render: ReadyNarration, line = this.getLine()): boolean {
    if (render.lineStartsSeconds.length !== this.#snapshot.track?.lines.length) return false;
    this.#render = render;
    const timings: LineTimings = {
      lineStarts: render.lineStartsSeconds,
      durationSeconds: render.durationSeconds,
    };
    this.#time = timings.lineStarts[line] ?? 0;
    this.#set({ timings });
    this.#emitTime();
    return true;
  }

  #usePacerTimings(line: number): void {
    const timings = estimatedLineStarts(this.#snapshot.track!.lines);
    this.#media?.pause();
    this.#time = timings.lineStarts[line] ?? 0;
    this.#set({ timings });
    this.#emitTime();
  }

  #fallBackToPacer(reason: PacerReason, start: boolean): void {
    const line = this.getLine();
    this.#render = null;
    this.#usePacerTimings(line);
    this.#set({ source: "pacer", pacerReason: reason, preparing: null, status: "ready", narratedVoice: null });
    if (start) this.#startPacer();
  }

  #pacerReasonFor(error: unknown): PacerReason {
    return isSyncRequestError(error) && error.code === "unauthenticated" ? "signedOut" : "unavailable";
  }

  #startPacer(): void {
    this.#stopPacer();
    const { durationSeconds } = this.#snapshot.timings;
    if (this.#time >= durationSeconds) this.#time = 0;
    this.#set({ status: "playing" });
    this.#pacerTimer = setInterval(() => {
      this.#time = Math.min(this.#time + (PACER_TICK_MS / 1000) * this.#snapshot.rate, durationSeconds);
      if (this.#time >= durationSeconds) {
        this.#stopPacer();
        this.#set({ status: "ended" });
      }
      this.#emitTime();
    }, PACER_TICK_MS);
  }

  #stopPacer(): void {
    if (this.#pacerTimer !== null) clearInterval(this.#pacerTimer);
    this.#pacerTimer = null;
  }

  #ensureMedia(): PlayerMedia {
    if (this.#media === null) {
      const media = this.#createMedia();
      media.preload = "auto";
      media.addEventListener("playing", () => this.#fromMedia("playing"));
      media.addEventListener("pause", () => {
        if (this.#snapshot.status === "playing" || this.#snapshot.status === "buffering") {
          this.#fromMedia("paused");
        }
      });
      media.addEventListener("waiting", () => {
        if (!media.paused) this.#fromMedia("buffering");
      });
      media.addEventListener("ended", () => this.#fromMedia("ended"));
      media.addEventListener("error", () => this.#fromMedia("failed"));
      media.addEventListener("timeupdate", () => {
        if (!this.#mediaIsCurrent()) return;
        this.#time = media.currentTime;
        this.#emitTime();
      });
      this.#media = media;
    }
    return this.#media;
  }

  // iOS lets a page start sound only inside a tap. Audio that is still being made arrives
  // after the tap is over, so the element is started on something silent while the tap
  // is still happening, and swapped for the narration when it lands.
  #unlockMedia(): void {
    if (this.#unlocked) return;
    this.#unlocked = true;
    const media = this.#ensureMedia();
    media.src = silentWavDataUri();
    this.#mediaSrc = null;
    media.play().catch(() => undefined);
  }

  #mediaUrl(): string | null {
    return this.#render === null || this.#api === null ? null : this.#api.fileUrl(this.#render);
  }

  #mediaIsCurrent(): boolean {
    const url = this.#mediaUrl();
    return url !== null && this.#snapshot.source === "audio" && this.#mediaSrc === url;
  }

  #loadMedia(): PlayerMedia {
    const media = this.#ensureMedia();
    const url = this.#mediaUrl()!;
    if (this.#mediaSrc !== url) {
      media.src = url;
      this.#mediaSrc = url;
    }
    media.currentTime = this.#time;
    media.playbackRate = this.#snapshot.rate;
    this.#unlocked = true;
    return media;
  }

  #playMedia(): void {
    const media = this.#loadMedia();
    this.#set({ status: "playing" });
    media.play().catch(() => {
      if (this.#mediaIsCurrent() && media.paused) this.#set({ status: "paused" });
    });
  }

  #fromMedia(status: PlayerStatus): void {
    if (!this.#mediaIsCurrent()) return;
    if (status === "ended") this.#time = this.#snapshot.timings.durationSeconds;
    this.#set({ status });
    this.#emitTime();
  }

  #clearPreparing(): void {
    if (this.#pollTimer !== null) clearTimeout(this.#pollTimer);
    if (this.#longTimer !== null) clearTimeout(this.#longTimer);
    this.#pollTimer = null;
    this.#longTimer = null;
  }

  #teardown(): void {
    this.#generation += 1;
    this.#clearPreparing();
    this.#stopPacer();
    this.#media?.pause();
    this.#render = null;
  }

  #script(): string[] {
    return scriptOf(this.#snapshot.track!);
  }

  #set(patch: Partial<PlayerSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...patch };
    for (const listener of this.#listeners) listener();
  }

  #emitTime(): void {
    for (const listener of this.#timeListeners) listener();
  }
}
