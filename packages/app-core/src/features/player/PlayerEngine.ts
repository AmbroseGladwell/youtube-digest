import {
  DEFAULT_NARRATION_VOICE,
  MAX_FIRST_SOUND_WAIT_MS,
  spokenLines,
  type ClientWarningReport,
  type ListenEnd,
  type NarrationRender,
  type NarrationVoice,
  type OverviewId,
  type PlaybackFrom,
  type PlaybackSource,
  type ReadyNarration,
  type StreamingNarration,
  isStreaming,
} from "@overview/domain";
import { isSyncRequestError, isSyncTransportError, type NarrationApi, type VoicedNarration } from "@overview/sync";
import type { PacerReason, PlayerSnapshot, PlayerSource, PlayerStatus, StreamProgress } from "./types/PlayerSnapshot.js";
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
// A stop lands just before the next line's first sound; a timer firing early is set again, not trusted.
export const STOP_AHEAD_SECONDS = 0.04;
const STOP_TIMER_SLACK_SECONDS = 0.005;
// Why a stalled element is nudged: docs/features/audio-player.md, "The states".
export const STALL_NUDGE_MS = 3_000;
const POLL_FAILURES_BEFORE_GIVING_UP = 3;
// How much audio a first play waits for, and a jump past the render then needs, before sound: docs/features/audio-player.md, "Playing while it renders".
export const STREAM_LEAD_SECONDS = 5;
export const HELD_LEAD_SECONDS = 2;
const STREAM_START_SLACK_SECONDS = 0.5;
const STREAM_STARTED_SECONDS = 0.25;

export type PlayerMedia = Pick<
  HTMLMediaElement,
  "src" | "currentTime" | "playbackRate" | "paused" | "play" | "pause" | "addEventListener" | "preload"
>;

// What it measures: docs/features/audio-player.md, "Time to first sound".
export interface FirstSoundReport {
  overviewId: OverviewId;
  waitMs: number;
  from: PlaybackFrom;
  source: PlaybackSource;
  prepared: boolean;
  streamed: boolean;
}

export interface WaitedAheadReport {
  overviewId: OverviewId;
  waitMs: number;
  outcome: "played" | "abandoned";
}

// Plays a playlist in the element, natively or through hls.js, and returns how to let it go.
export type LoadStream = (media: PlayerMedia, url: string, shouldPlay: () => boolean) => () => void;

const loadNatively: LoadStream = (media, url) => {
  media.src = url;
  return () => undefined;
};

export interface ListenStartedReport {
  overviewId: OverviewId;
  source: PlaybackSource;
}

// What it measures: docs/features/audio-player.md, "How far a listen got".
export interface ListenEndedReport {
  overviewId: OverviewId;
  source: PlaybackSource;
  percentHeard: number;
  reason: ListenEnd;
  withOpening: boolean;
}

export interface PlayerEngineOptions {
  api: NarrationApi | null;
  createMedia: () => PlayerMedia;
  voice?: NarrationVoice;
  warn?: (warning: ClientWarningReport) => void;
  onFirstSound?: (report: FirstSoundReport) => void;
  onListenStarted?: (report: ListenStartedReport) => void;
  onListenEnded?: (report: ListenEndedReport) => void;
  onWaitedAhead?: (report: WaitedAheadReport) => void;
  loadStream?: LoadStream;
  now?: () => number;
}

interface Press {
  at: number;
  from: PlaybackFrom;
  prepared: boolean;
  streamed: boolean;
}

interface Hold {
  line: number;
  at: number;
  from: number;
}

interface RenderSample {
  at: number;
  renderedSeconds: number;
}

type Stretch = [start: number, end: number];

interface Listen {
  heard: Stretch[];
  run: Stretch | null;
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
  docked: false,
  stream: null,
};

const SOUNDING = new Set<PlayerStatus>(["preparing", "playing", "buffering"]);
const RESTING_WITHOUT_SOUND = new Set<PlayerStatus>(["paused", "ended", "failed", "busy"]);

const scriptOf = (track: PlayerTrack) => spokenLines(track.lines, track.opening);

const isDailyNarrationSpent = (error: unknown): boolean =>
  isSyncRequestError(error) && error.code === "too_many_requests" && error.details?.quota === "narration-daily";

export const OPENING_LINE = -1;

// Older renders have no opening timing: docs/features/tts-pre-rendered-speech.md, "The spoken script".
const lineStartsOf = (render: ReadyNarration, track: PlayerTrack): number[] | null => {
  const { lineStartsSeconds } = render;
  if (track.opening !== null && lineStartsSeconds.length === track.lines.length + 1) {
    return lineStartsSeconds.slice(1);
  }
  if (lineStartsSeconds.length === track.lines.length) {
    return lineStartsSeconds;
  }
  return null;
};

const knownLineStartsOf = (render: StreamingNarration, track: PlayerTrack): number[] =>
  (track.opening === null ? render.lineStartsSeconds : render.lineStartsSeconds.slice(1)).slice(0, track.lines.length);

// Lines not yet rendered are placed after the last one that is, at the pace the rendered ones set.
export const streamingTimings = (render: StreamingNarration, track: PlayerTrack): LineTimings => {
  const estimate = estimatedLineStarts(track.lines);
  const known = knownLineStartsOf(render, track);
  if (known.length === 0) {
    return { lineStarts: estimate.lineStarts, durationSeconds: Math.max(estimate.durationSeconds, render.renderedSeconds) };
  }
  const last = known.length - 1;
  const estimatedSpan = estimate.lineStarts[last]! - estimate.lineStarts[0]!;
  const pace = last > 0 && estimatedSpan > 0 ? (known[last]! - known[0]!) / estimatedSpan : 1;
  const after = (estimated: number) => known[last]! + (estimated - estimate.lineStarts[last]!) * pace;
  const lineStarts = track.lines.map((_, index) => (index <= last ? known[index]! : after(estimate.lineStarts[index]!)));
  return { lineStarts, durationSeconds: Math.max(after(estimate.durationSeconds), render.renderedSeconds) };
};

const sameTrack = (a: PlayerTrack | null, b: PlayerTrack) => {
  if (a === null || a.overviewId !== b.overviewId || a.lines.length !== b.lines.length) {
    return false;
  }
  const aScript = scriptOf(a);
  const bScript = scriptOf(b);
  return a.lines.every((line, index) => line.text === b.lines[index]!.text && aScript[index] === bScript[index]);
};

export class PlayerEngine {
  #api: NarrationApi | null;
  #createMedia: () => PlayerMedia;
  #media: PlayerMedia | null = null;
  #mediaSrc: string | null = null;
  #unlocked = false;
  #snapshot: PlayerSnapshot;
  #time = 0;
  #render: ReadyNarration | null = null;
  #stream: StreamingNarration | null = null;
  #streamUrl: string | null = null;
  #releaseStream: () => void = () => undefined;
  #loadStream: LoadStream;
  #hold: Hold | null = null;
  #streamStartPending = false;
  #firstRenderSample: RenderSample | null = null;
  #onWaitedAhead: (report: WaitedAheadReport) => void;
  #replacing: string | null = null;
  #generation = 0;
  #pollTimer: ReturnType<typeof setTimeout> | null = null;
  #longTimer: ReturnType<typeof setTimeout> | null = null;
  #pacerTimer: ReturnType<typeof setInterval> | null = null;
  #stopLine: number | null = null;
  #stopTimer: ReturnType<typeof setTimeout> | null = null;
  #stallTimer: ReturnType<typeof setTimeout> | null = null;
  #pollFailures = 0;
  #watchChecks = 0;
  #warn: (warning: ClientWarningReport) => void;
  #onFirstSound: (report: FirstSoundReport) => void;
  #onListenStarted: (report: ListenStartedReport) => void;
  #onListenEnded: (report: ListenEndedReport) => void;
  #clock: () => number;
  #press: Press | null = null;
  #listen: Listen | null = null;
  #listeners = new Set<() => void>();
  #openNotes = new Map<OverviewId, number>();
  #timeListeners = new Set<() => void>();

  constructor({
    api,
    createMedia,
    voice = DEFAULT_NARRATION_VOICE,
    warn = () => undefined,
    onFirstSound = () => undefined,
    onListenStarted = () => undefined,
    onListenEnded = () => undefined,
    onWaitedAhead = () => undefined,
    loadStream = loadNatively,
    now = () => performance.now(),
  }: PlayerEngineOptions) {
    this.#onWaitedAhead = onWaitedAhead;
    this.#loadStream = loadStream;
    this.#api = api;
    this.#warn = warn;
    this.#onFirstSound = onFirstSound;
    this.#onListenStarted = onListenStarted;
    this.#onListenEnded = onListenEnded;
    this.#clock = now;
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
  getLine = (): number => {
    const { lineStarts } = this.#snapshot.timings;
    return this.#time < (lineStarts[0] ?? 0) ? OPENING_LINE : lineAtTime(lineStarts, this.#time);
  };
  canNarrate = (): boolean => this.#api !== null;

  setApi(api: NarrationApi | null): void {
    if (api === this.#api) {
      return;
    }
    this.#api = api;
    const { track, status } = this.#snapshot;
    const pacerAtRest = this.#snapshot.source === "pacer" && status !== "playing";
    const notYetPlayed = status === "ready" || pacerAtRest;
    if (track !== null && notYetPlayed) {
      const line = this.getLine();
      this.#teardown();
      this.#begin(track, line);
    }
  }

  setVoice(voice: NarrationVoice): void {
    if (voice === this.#snapshot.voice) {
      return;
    }
    this.#set({ voice });
    const { track, status, source } = this.#snapshot;
    const audioNotYetPlayed = status === "ready" && source === "audio" && this.#api !== null;
    if (track !== null && audioNotYetPlayed) {
      const line = this.getLine();
      this.#teardown();
      this.#begin(track, line);
    }
  }

  // The older voice's narration is thrown away only once the chosen voice's has landed.
  reRecord(): void {
    const { track, narratedVoice, voice, status } = this.#snapshot;
    if (track === null || narratedVoice === null || narratedVoice === voice || status === "preparing") {
      return;
    }
    if (status === "playing" || status === "buffering") {
      this.pause();
    }
    if (status === "ended") {
      this.#time = 0;
    }
    this.#replacing = this.#render?.key ?? null;
    this.#requestRender();
  }

  load(track: PlayerTrack, startLine = 0): void {
    if (sameTrack(this.#snapshot.track, track)) {
      return;
    }
    this.#endListen("switchedNote");
    this.#teardown();
    this.#begin(track, startLine);
  }

  stop(): void {
    this.#endListen("stopped");
    this.#teardown();
    this.#time = 0;
    this.#set({ ...IDLE, rate: this.#snapshot.rate, voice: this.#snapshot.voice });
    this.#emitTime();
  }

  notePageOpened(overviewId: OverviewId): void {
    this.#openNotes.set(overviewId, (this.#openNotes.get(overviewId) ?? 0) + 1);
    this.#set({});
  }

  notePageClosed(overviewId: OverviewId): void {
    const open = (this.#openNotes.get(overviewId) ?? 1) - 1;
    if (open > 0) {
      this.#openNotes.set(overviewId, open);
    } else {
      this.#openNotes.delete(overviewId);
    }
    this.#set({});
  }

  endSession(): void {
    this.#endListen("signedOut");
    this.stop();
  }

  toggle(from: PlaybackFrom): void {
    const { status } = this.#snapshot;
    if (status === "playing" || status === "buffering") {
      this.pause();
    } else if (status === "preparing") {
      this.cancel();
    } else {
      this.play(from);
    }
  }

  play(from: PlaybackFrom): void {
    const { track, status, source } = this.#snapshot;
    if (track === null || status === "playing" || status === "preparing") {
      return;
    }
    if (status === "ended") {
      this.#time = 0;
      this.#letStreamGo();
    }
    this.#press = status === "paused" ? null : { at: this.#clock(), from, prepared: false, streamed: false };
    if (status === "paused" && this.#isAheadOfRender(this.#time)) {
      this.#holdAt(this.#time);
      return;
    }
    if (status === "failed" || status === "busy") {
      this.#requestRender();
      return;
    }
    if (source === "pacer") {
      this.#startPacer();
      return;
    }
    if (this.#render !== null || this.#streamUrl !== null) {
      this.#playMedia();
      return;
    }
    this.#requestRender();
  }

  pause(): void {
    const { status, source } = this.#snapshot;
    if (status !== "playing" && status !== "buffering") {
      return;
    }
    this.#endHold("abandoned");
    if (source === "pacer") {
      this.#stopPacer();
    } else {
      this.#media?.pause();
    }
    this.#set({ status: "paused" });
    this.#armStop();
  }

  // Why a cancel peeks again: docs/features/audio-player.md, "A note opened before its audio lands".
  cancel(): void {
    if (this.#snapshot.status !== "preparing") {
      return;
    }
    this.#press = null;
    this.#generation += 1;
    this.#replacing = null;
    this.#clearPreparing();
    this.#set({ status: "ready", preparing: null });
    if (this.#api !== null && this.#snapshot.source === "audio") {
      this.#peek(true);
    }
  }

  readAlong(): void {
    const { status, track } = this.#snapshot;
    if (track === null) {
      return;
    }
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
    if (track === null) {
      return;
    }
    this.#cutRun();
    const target = Math.min(Math.max(seconds, 0), timings.durationSeconds);
    const sounding = status === "playing" || status === "buffering";
    if (sounding && this.#isAheadOfRender(target)) {
      this.#holdAt(target);
      return;
    }
    const wasHeld = this.#hold !== null;
    this.#endHold("abandoned");
    this.#time = target;
    if (this.#mediaIsCurrent()) {
      this.#media!.currentTime = this.#time;
    }
    if (wasHeld) {
      this.#playMedia();
    }
    if (status === "ended") {
      this.#set({ status: "paused" });
    }
    this.#armStop();
    this.#emitTime();
  }

  // 42d's "Back to": where the reader was before jumping past the render.
  backFromHold(): void {
    const from = this.#hold?.from;
    if (from !== undefined) {
      this.seek(from);
    }
  }

  seekLine(index: number): void {
    const { lineStarts } = this.#snapshot.timings;
    const clamped = Math.min(Math.max(index, 0), Math.max(lineStarts.length - 1, 0));
    this.seek(lineStarts[clamped] ?? 0);
  }

  // Why the engine times the stop itself: docs/features/recipe-notes.md, "Reading aloud".
  stopAfterLine(index: number | null): void {
    this.#stopLine = index;
    this.#armStop();
  }

  stepLine(delta: number): void {
    this.seekLine(this.getLine() + delta);
  }

  skip(deltaSeconds: number): void {
    this.seek(this.#time + deltaSeconds);
  }

  cycleRate(): void {
    const next = PLAYER_RATES[(PLAYER_RATES.indexOf(this.#snapshot.rate) + 1) % PLAYER_RATES.length]!;
    if (this.#media !== null) {
      this.#media.playbackRate = next;
    }
    this.#set({ rate: next });
    this.#armStop();
  }

  // Why nothing waits on the answer: docs/features/audio-player.md, "A note just made".
  prepare(track: PlayerTrack): void {
    this.#api?.request(scriptOf(track), this.#snapshot.voice, "background").catch(() => undefined);
  }

  // Out of sight, a listen still playing carries on, as on a locked phone; one paused is left.
  pageHidden(): void {
    if (this.#snapshot.status === "paused") {
      this.#endListen("left");
    }
  }

  pageLeft(): void {
    this.#endListen("left");
  }

  #begin(track: PlayerTrack, startLine: number): void {
    const timings = estimatedLineStarts(track.lines);
    this.#render = null;
    this.#letStreamGo();
    this.#cutRun();
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
      stream: null,
    });
    this.#emitTime();
    if (signedIn) {
      this.#peek();
    }
  }

  #peek(afterCancel = false): void {
    const api = this.#api!;
    const generation = this.#generation;
    this.#watchChecks = 0;
    api
      .peek(this.#script(), this.#snapshot.voice)
      .then((found) => {
        if (generation !== this.#generation) {
          return;
        }
        this.#pollFailures = 0;
        this.#onPeeked(found, generation);
      })
      .catch((error: unknown) => {
        if (generation !== this.#generation) {
          return;
        }
        const reason = this.#pacerReasonFor(error);
        if (afterCancel && reason !== "signedOut") {
          this.#set({ availability: "onFirstPlay", preparing: null });
          return;
        }
        this.#fallBackToPacer(reason, false);
      });
  }

  // Why watched slowly: docs/features/audio-player.md, "A note opened before its audio lands".
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
    if (this.#snapshot.availability !== "ready") {
      this.#set({ availability: "onFirstPlay", preparing: null });
    }
  }

  #watch({ voice, render: watched }: VoicedNarration, generation: number): void {
    if (generation !== this.#generation || this.#api === null) {
      return;
    }
    this.#watchChecks += 1;
    this.#api
      .status(watched.key)
      .then((render) => {
        if (generation !== this.#generation) {
          return;
        }
        this.#pollFailures = 0;
        this.#onPeeked({ voice, render }, generation);
      })
      .catch((error: unknown) => {
        if (generation !== this.#generation) {
          return;
        }
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
        if (generation !== this.#generation) {
          return;
        }
        this.#replacing = null;
        this.#clearPreparing();
        if (isDailyNarrationSpent(error)) {
          this.#fallBackToPacer("dailyCap", true);
          return;
        }
        if (isSyncRequestError(error) && error.code === "too_many_requests") {
          this.#set({ status: "busy", preparing: null });
          return;
        }
        const reason = this.#pacerReasonFor(error);
        if (reason === "unavailable") {
          this.#warnRequestFailed(error);
        }
        this.#fallBackToPacer(reason, true);
      });
  }

  #onRender(render: NarrationRender, generation: number, voice: NarrationVoice): void {
    if (generation !== this.#generation) {
      return;
    }
    this.#pollFailures = 0;
    if (render.status === "queued" || render.status === "rendering") {
      if (this.#press !== null) {
        this.#press.prepared = true;
      }
      if (isStreaming(render) && this.#canStream(render)) {
        this.#playStream(render, generation, voice);
        return;
      }
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
      this.#warn({ name: "narrationFellBack", reason: "renderFailed" });
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
    if (generation !== this.#generation || this.#api === null) {
      return;
    }
    this.#api
      .status(key)
      .then((render) => this.#onRender(render, generation, voice))
      .catch((error: unknown) => {
        if (generation !== this.#generation) {
          return;
        }
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

  #canStream(render: StreamingNarration): boolean {
    const { source, status, track } = this.#snapshot;
    return (
      source === "audio" &&
      status === "preparing" &&
      track !== null &&
      render.renderedSeconds >= STREAM_LEAD_SECONDS &&
      render.lineStartsSeconds.length <= track.lines.length + (track.opening === null ? 0 : 1)
    );
  }

  // Why and how: docs/features/audio-player.md, "Playing while it renders".
  #playStream(render: StreamingNarration, generation: number, voice: NarrationVoice): void {
    const line = this.getLine();
    if (this.#longTimer !== null) {
      clearTimeout(this.#longTimer);
      this.#longTimer = null;
    }
    if (this.#press !== null) {
      this.#press.streamed = true;
    }
    this.#stream = render;
    this.#firstRenderSample = { at: this.#clock(), renderedSeconds: render.renderedSeconds };
    this.#streamUrl = this.#api!.fileUrl({ fileUrl: render.playlistUrl });
    const timings = streamingTimings(render, this.#snapshot.track!);
    this.#retime(timings);
    this.#time = line <= 0 ? 0 : (timings.lineStarts[line] ?? 0);
    this.#set({
      source: "audio",
      pacerReason: null,
      preparing: null,
      narratedVoice: voice,
      stream: this.#progress(),
    });
    this.#emitTime();
    if (this.#isAheadOfRender(this.#time)) {
      this.#loadMedia();
      this.#holdAt(this.#time);
    } else {
      this.#playMedia();
    }
    this.#pollTimer = setTimeout(() => this.#pollStream(render.key, generation, voice), POLL_INTERVAL_MS);
  }

  #pollStream(key: string, generation: number, voice: NarrationVoice): void {
    if (generation !== this.#generation || this.#api === null) {
      return;
    }
    this.#api
      .status(key)
      .then((render) => {
        if (generation !== this.#generation) {
          return;
        }
        this.#pollFailures = 0;
        if (render.status === "ready") {
          this.#streamFinished(render, voice);
          return;
        }
        if (render.status === "failed") {
          this.#letStreamGo();
          this.#renderGaveUp();
          return;
        }
        if (isStreaming(render)) {
          this.#streamGrew(render);
        }
        this.#pollTimer = setTimeout(() => this.#pollStream(key, generation, voice), POLL_INTERVAL_MS);
      })
      .catch(() => {
        if (generation !== this.#generation) {
          return;
        }
        this.#pollFailures += 1;
        this.#pollTimer = setTimeout(() => this.#pollStream(key, generation, voice), POLL_INTERVAL_MS * 2);
      });
  }

  #streamGrew(render: StreamingNarration): void {
    this.#stream = render;
    const timings = streamingTimings(render, this.#snapshot.track!);
    this.#retime(timings);
    this.#set({ stream: this.#progress() });
    this.#resumeHoldIfRendered();
  }

  // The playlist keeps playing to its end; the stored file takes over from the next play.
  #streamFinished(render: ReadyNarration, voice: NarrationVoice): void {
    const track = this.#snapshot.track!;
    const lineStarts = lineStartsOf(render, track);
    if (lineStarts === null) {
      this.#warn({ name: "narrationFellBack", reason: "renderFailed" });
      this.#letStreamGo();
      this.#fallBackToPacer("unavailable", this.#snapshot.status === "playing");
      return;
    }
    this.#render = render;
    this.#stream = null;
    this.#retime({ lineStarts, durationSeconds: render.durationSeconds });
    this.#set({ availability: "ready", narratedVoice: voice, stream: null });
    this.#resumeHoldIfRendered();
    this.#emitTime();
  }

  // Seconds of audio made per second of waiting, measured between polls: never assumed.
  #renderPace(): number | null {
    const first = this.#firstRenderSample;
    const stream = this.#stream;
    if (first === null || stream === null) {
      return null;
    }
    const waited = (this.#clock() - first.at) / 1000;
    const made = stream.renderedSeconds - first.renderedSeconds;
    return waited > 0 && made > 0 ? made / waited : null;
  }

  #progress(): StreamProgress {
    const hold = this.#hold;
    return {
      renderedSeconds: this.#stream?.renderedSeconds ?? 0,
      holdingLine: hold?.line ?? null,
      holdingFrom: hold?.from ?? null,
      renderPace: this.#renderPace(),
    };
  }

  #isAheadOfRender(seconds: number): boolean {
    const stream = this.#stream;
    return this.#streamUrl !== null && stream !== null && seconds > stream.renderedSeconds - HELD_LEAD_SECONDS;
  }

  #holdAt(seconds: number): void {
    const { timings } = this.#snapshot;
    const line = lineAtTime(timings.lineStarts, seconds);
    const from = this.#hold?.from ?? this.#now();
    this.#hold = { line, at: this.#hold?.at ?? this.#clock(), from };
    this.#time = timings.lineStarts[line] ?? seconds;
    this.#media?.pause();
    this.#set({ status: "buffering", stream: this.#progress() });
    this.#armStop();
    this.#emitTime();
  }

  #resumeHoldIfRendered(): void {
    const hold = this.#hold;
    if (hold === null) {
      return;
    }
    const stream = this.#stream;
    const track = this.#snapshot.track!;
    const rendered =
      stream === null ||
      (knownLineStartsOf(stream, track).length > hold.line &&
        stream.renderedSeconds >= this.#snapshot.timings.lineStarts[hold.line]! + HELD_LEAD_SECONDS);
    if (!rendered) {
      return;
    }
    this.#time = this.#snapshot.timings.lineStarts[hold.line] ?? 0;
    this.#endHold("played");
    this.#playMedia();
    this.#emitTime();
  }

  #endHold(outcome: WaitedAheadReport["outcome"]): void {
    const hold = this.#hold;
    const { track, stream } = this.#snapshot;
    if (hold === null) {
      return;
    }
    this.#hold = null;
    if (stream !== null) {
      this.#set({ stream: this.#progress() });
    }
    if (track !== null) {
      const waitMs = Math.min(Math.max(Math.round(this.#clock() - hold.at), 0), MAX_FIRST_SOUND_WAIT_MS);
      this.#onWaitedAhead({ overviewId: track.overviewId, waitMs, outcome });
    }
  }

  #letStreamGo(): void {
    this.#endHold("abandoned");
    this.#releaseStream();
    this.#releaseStream = () => undefined;
    this.#stream = null;
    this.#streamUrl = null;
    this.#firstRenderSample = null;
    if (this.#snapshot.stream !== null) {
      this.#set({ stream: null });
    }
  }

  #discardReplaced(key: string): void {
    const replaced = this.#replacing;
    this.#replacing = null;
    if (replaced !== null && replaced !== key) {
      this.#api?.discard(replaced).catch(() => undefined);
    }
  }

  #renderGaveUp(): void {
    this.#warn({ name: "narrationFellBack", reason: "renderFailed" });
    this.#replacing = null;
    if (this.#snapshot.source === "pacer") {
      this.#set({ pacerReason: "unavailable", preparing: null });
      return;
    }
    this.#set({ status: "failed", preparing: null });
  }

  // False when the render doesn't describe these lines: a wrong highlight is worse than the pacer.
  #adopt(render: ReadyNarration, line = this.getLine()): boolean {
    const track = this.#snapshot.track;
    const lineStarts = track ? lineStartsOf(render, track) : null;
    if (lineStarts === null) {
      return false;
    }
    this.#render = render;
    const timings: LineTimings = { lineStarts, durationSeconds: render.durationSeconds };
    this.#retime(timings);
    this.#time = line <= 0 ? 0 : (timings.lineStarts[line] ?? 0);
    this.#emitTime();
    return true;
  }

  #usePacerTimings(line: number): void {
    const timings = estimatedLineStarts(this.#snapshot.track!.lines);
    this.#media?.pause();
    this.#retime(timings);
    this.#time = timings.lineStarts[line] ?? 0;
    this.#emitTime();
  }

  #retime(timings: LineTimings): void {
    this.#cutRun();
    const listen = this.#listen;
    const from = this.#snapshot.timings.durationSeconds;
    if (listen !== null && from > 0 && timings.durationSeconds !== from) {
      const scale = timings.durationSeconds / from;
      listen.heard = listen.heard.map(([start, end]) => [start * scale, end * scale]);
    }
    this.#set({ timings });
  }

  #fallBackToPacer(reason: PacerReason, start: boolean): void {
    const line = this.getLine();
    this.#render = null;
    this.#usePacerTimings(line);
    this.#set({ source: "pacer", pacerReason: reason, preparing: null, status: "ready", narratedVoice: null });
    if (start) {
      this.#startPacer();
    }
  }

  #warnRequestFailed(error: unknown): void {
    const requestId = isSyncRequestError(error) || isSyncTransportError(error) ? error.requestId : undefined;
    this.#warn({
      name: "narrationFellBack",
      reason: "requestFailed",
      ...(requestId === undefined ? {} : { requestId }),
      ...(isSyncRequestError(error) ? { apiErrorCode: error.code } : {}),
    });
  }

  #pacerReasonFor(error: unknown): PacerReason {
    return isSyncRequestError(error) && error.code === "unauthenticated" ? "signedOut" : "unavailable";
  }

  #stopTime(): number | null {
    if (this.#stopLine === null) {
      return null;
    }
    return this.#snapshot.timings.lineStarts[this.#stopLine + 1] ?? null;
  }

  #now(): number {
    return this.#mediaIsCurrent() ? this.#media!.currentTime : this.#time;
  }

  #pastStop(): boolean {
    const stopAt = this.#stopTime();
    return stopAt !== null && this.#now() >= stopAt - STOP_AHEAD_SECONDS;
  }

  #armStop(): void {
    if (this.#stopTimer !== null) {
      clearTimeout(this.#stopTimer);
    }
    this.#stopTimer = null;
    const stopAt = this.#stopTime();
    if (stopAt === null || this.#snapshot.status !== "playing") {
      return;
    }
    const wait = (stopAt - STOP_AHEAD_SECONDS - this.#now()) / this.#snapshot.rate;
    this.#stopTimer = setTimeout(() => this.#reachStop(), Math.max(0, wait * 1000));
  }

  #reachStop(): void {
    this.#stopTimer = null;
    const stopAt = this.#stopTime();
    if (stopAt === null) {
      return;
    }
    if (this.#now() < stopAt - STOP_AHEAD_SECONDS - STOP_TIMER_SLACK_SECONDS) {
      this.#armStop();
      return;
    }
    const at = Math.min(this.#now(), stopAt - STOP_AHEAD_SECONDS);
    this.#stopLine = null;
    this.pause();
    this.#time = at;
    if (this.#mediaIsCurrent()) {
      this.#media!.currentTime = at;
    }
    this.#emitTime();
  }

  #startPacer(): void {
    this.#stopPacer();
    const { durationSeconds } = this.#snapshot.timings;
    if (this.#time >= durationSeconds) {
      this.#time = 0;
    }
    this.#set({ status: "playing" });
    this.#armStop();
    this.#pacerTimer = setInterval(() => {
      this.#sounded("pacer");
      const before = this.#time;
      this.#time = Math.min(before + (PACER_TICK_MS / 1000) * this.#snapshot.rate, durationSeconds);
      this.#heard(before, this.#time);
      if (this.#pastStop()) {
        this.#reachStop();
        return;
      }
      if (this.#time >= durationSeconds) {
        this.#stopPacer();
        this.#set({ status: "ended" });
        this.#endListen("finished");
      }
      this.#emitTime();
    }, PACER_TICK_MS);
  }

  #stopPacer(): void {
    if (this.#pacerTimer !== null) {
      clearInterval(this.#pacerTimer);
    }
    this.#pacerTimer = null;
  }

  #ensureMedia(): PlayerMedia {
    if (this.#media === null) {
      const media = this.#createMedia();
      media.preload = "auto";
      media.addEventListener("loadedmetadata", () => this.#startStreamWhereMeant());
      media.addEventListener("playing", () => {
        this.#startStreamWhereMeant();
        this.#fromMedia("playing");
      });
      media.addEventListener("pause", () => {
        if (this.#hold !== null) {
          return;
        }
        if (this.#snapshot.status === "playing" || this.#snapshot.status === "buffering") {
          this.#fromMedia("paused");
        }
      });
      media.addEventListener("waiting", () => {
        if (!media.paused && this.#hold === null) {
          this.#fromMedia("buffering");
        }
      });
      media.addEventListener("ended", () => this.#fromMedia("ended"));
      media.addEventListener("error", () => this.#fromMedia("failed"));
      media.addEventListener("timeupdate", () => {
        if (!this.#mediaIsCurrent() || this.#hold !== null || this.#startStreamWhereMeant()) {
          return;
        }
        const before = this.#time;
        this.#time = media.currentTime;
        this.#heard(before, this.#time);
        if (this.#pastStop()) {
          this.#reachStop();
          return;
        }
        this.#armStop();
        this.#emitTime();
      });
      this.#media = media;
    }
    return this.#media;
  }

  // Why start on silence: docs/features/audio-player.md, "iOS and the lock screen".
  #unlockMedia(): void {
    if (this.#unlocked) {
      return;
    }
    this.#unlocked = true;
    const media = this.#ensureMedia();
    media.src = silentWavDataUri();
    this.#mediaSrc = null;
    media.play().catch(() => undefined);
  }

  #mediaUrl(): string | null {
    if (this.#streamUrl !== null) {
      return this.#streamUrl;
    }
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
      this.#releaseStream();
      this.#releaseStream = () => undefined;
      if (url === this.#streamUrl) {
        this.#streamStartPending = true;
        this.#releaseStream = this.#loadStream(media, url, () => this.#snapshot.status === "playing");
      } else {
        media.src = url;
      }
      this.#mediaSrc = url;
    }
    // A second seek to where a pending one is going can leave Chromium waiting for good (OV-278).
    if (media.currentTime !== this.#time) {
      media.currentTime = this.#time;
    }
    media.playbackRate = this.#snapshot.rate;
    this.#unlocked = true;
    return media;
  }

  #playMedia(): void {
    const media = this.#loadMedia();
    this.#set({ status: "playing" });
    this.#armStop();
    media.play().catch(() => {
      if (this.#mediaIsCurrent() && media.paused) {
        this.#set({ status: "paused" });
      }
    });
  }

  #fromMedia(status: PlayerStatus): void {
    if (!this.#mediaIsCurrent()) {
      return;
    }
    if (status === "ended" && this.#endedTooSoon()) {
      const media = this.#media!;
      const here = media.currentTime;
      media.currentTime = here;
      media.play().catch(() => undefined);
      this.#set({ status: "buffering" });
      this.#watchForStall();
      return;
    }
    if (status === "ended") {
      const { durationSeconds } = this.#snapshot.timings;
      this.#heard(this.#time, durationSeconds);
      this.#time = durationSeconds;
    }
    this.#set({ status });
    if (status === "playing") {
      this.#sounded("audio");
    }
    if (status === "ended") {
      this.#endListen("finished");
      if (this.#streamUrl !== null && this.#stream === null) {
        this.#letStreamGo();
      }
    }
    this.#watchForStall();
    this.#armStop();
    this.#emitTime();
  }

  // Safari starts a growing playlist near its end, as if it were live, whatever EXT-X-START says.
  #startStreamWhereMeant(): boolean {
    if (!this.#streamStartPending || !this.#mediaIsCurrent() || this.#hold !== null) {
      return false;
    }
    const media = this.#media!;
    const off = media.currentTime - this.#time;
    if (Math.abs(off) > STREAM_START_SLACK_SECONDS) {
      this.#streamStartPending = false;
      media.currentTime = this.#time;
      return true;
    }
    if (off > STREAM_STARTED_SECONDS) {
      this.#streamStartPending = false;
    }
    return false;
  }

  // A playlist can report its end at the last point it had buffered while the render was still going.
  #endedTooSoon(): boolean {
    return this.#streamUrl !== null && (this.#stream !== null || this.#media!.currentTime < this.#snapshot.timings.durationSeconds - 1);
  }

  #watchForStall(): void {
    if (this.#stallTimer !== null) {
      clearTimeout(this.#stallTimer);
    }
    this.#stallTimer = null;
    if (this.#snapshot.status !== "buffering") {
      return;
    }
    this.#stallTimer = setTimeout(() => {
      this.#stallTimer = null;
      if (this.#snapshot.status !== "buffering" || !this.#mediaIsCurrent()) {
        return;
      }
      const media = this.#media!;
      const here = media.currentTime;
      media.currentTime = here;
    }, STALL_NUDGE_MS);
  }

  #sounded(source: PlayerSource): void {
    this.#reportFirstSound(source);
    const { track } = this.#snapshot;
    if (this.#listen !== null || track === null) {
      return;
    }
    this.#listen = { heard: [], run: null };
    this.#onListenStarted({ overviewId: track.overviewId, source });
  }

  #heard(from: number, to: number): void {
    const listen = this.#listen;
    if (listen === null || to < from) {
      return;
    }
    if (listen.run === null) {
      listen.run = [from, to];
    } else {
      listen.run[1] = Math.max(listen.run[1], to);
    }
  }

  #cutRun(): void {
    const listen = this.#listen;
    if (listen === null || listen.run === null) {
      return;
    }
    listen.heard.push(listen.run);
    listen.run = null;
  }

  #percentHeard(listen: Listen): number {
    const { durationSeconds } = this.#snapshot.timings;
    if (durationSeconds <= 0) {
      return 0;
    }
    const stretches = [...listen.heard, ...(listen.run === null ? [] : [listen.run])].sort((a, b) => a[0] - b[0]);
    let heard = 0;
    let reached = Number.NEGATIVE_INFINITY;
    for (const [start, end] of stretches) {
      heard += Math.max(0, end - Math.max(start, reached));
      reached = Math.max(reached, end);
    }
    return Math.min(100, Math.round((heard / durationSeconds) * 10) * 10);
  }

  #endListen(reason: ListenEnd): void {
    const listen = this.#listen;
    const { track, source } = this.#snapshot;
    if (listen === null || track === null) {
      return;
    }
    this.#listen = null;
    this.#onListenEnded({
      overviewId: track.overviewId,
      source,
      percentHeard: this.#percentHeard(listen),
      reason,
      withOpening: this.#withOpening(),
    });
  }

  #withOpening(): boolean {
    const { track, source } = this.#snapshot;
    const render = this.#render;
    return source === "audio" && render !== null && track !== null && render.lineStartsSeconds.length === track.lines.length + 1;
  }

  #reportFirstSound(source: PlayerSource): void {
    const press = this.#press;
    const { track } = this.#snapshot;
    if (press === null || track === null) {
      return;
    }
    this.#press = null;
    const waitMs = Math.min(Math.max(Math.round(this.#clock() - press.at), 0), MAX_FIRST_SOUND_WAIT_MS);
    this.#onFirstSound({
      overviewId: track.overviewId,
      waitMs,
      from: press.from,
      source,
      prepared: press.prepared,
      streamed: press.streamed,
    });
  }

  #clearPreparing(): void {
    if (this.#pollTimer !== null) {
      clearTimeout(this.#pollTimer);
    }
    if (this.#longTimer !== null) {
      clearTimeout(this.#longTimer);
    }
    this.#pollTimer = null;
    this.#longTimer = null;
  }

  #teardown(): void {
    this.#press = null;
    this.#stopLine = null;
    this.#armStop();
    if (this.#stallTimer !== null) {
      clearTimeout(this.#stallTimer);
    }
    this.#stallTimer = null;
    this.#generation += 1;
    this.#clearPreparing();
    this.#stopPacer();
    this.#letStreamGo();
    this.#media?.pause();
    this.#render = null;
  }

  #script(): string[] {
    return scriptOf(this.#snapshot.track!);
  }

  #set(patch: Partial<PlayerSnapshot>): void {
    const { status } = patch;
    if (status !== undefined && RESTING_WITHOUT_SOUND.has(status)) {
      this.#press = null;
    }
    const next = { ...this.#snapshot, ...patch };
    this.#snapshot = { ...next, docked: this.#dockedAfter(next) };
    for (const listener of this.#listeners) {
      listener();
    }
  }

  #dockedAfter({ track, status }: PlayerSnapshot): boolean {
    if (track === null || this.#openNotes.has(track.overviewId)) {
      return false;
    }
    const sameTrack = this.#snapshot.track?.overviewId === track.overviewId;
    return SOUNDING.has(status) || (sameTrack && this.#snapshot.docked);
  }

  #emitTime(): void {
    for (const listener of this.#timeListeners) {
      listener();
    }
  }
}
