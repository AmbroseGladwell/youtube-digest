import type { ChatSpeechEvent } from "@overview/domain";
import type { ChatApi } from "@overview/sync";
import { SyncRequestError } from "@overview/sync";
import { lineAtTime } from "../../player/util/lineAtTime.js";
import { silentWavDataUri } from "../../player/util/silentWavDataUri.js";

export type SentenceOnScreen = Extract<ChatSpeechEvent, { type: "sentences" }>["sentences"][number];
export type ReadAloudStatus = "idle" | "starting" | "playing" | "paused";
export type ReadAloudControl = "top" | "bottom";

export interface AnswerRef {
  chatId: string;
  message: number;
}

export type ReadAloudProblem = { kind: "failed" } | { kind: "spent"; quota: "month" | "day"; resetsOn: string | null };

export interface ReadAloudSnapshot {
  answer: AnswerRef | null;
  status: ReadAloudStatus;
  sentence: number | null;
  sentences: readonly SentenceOnScreen[];
  problem: { answer: AnswerRef; problem: ReadAloudProblem } | null;
  heldNarration: boolean;
  voiceless: boolean;
}

export type ReadAloudScope = "overview" | "library" | "project";

export interface ReadAloudMeta {
  control: ReadAloudControl;
  scope: ReadAloudScope;
  title: string;
  artist: string;
  artworkUrl: string | null;
}

export type ReadAloudMedia = Pick<HTMLMediaElement, "src" | "currentTime" | "paused" | "play" | "pause" | "addEventListener">;

export interface ReadAloudNarration {
  isPlaying(): boolean;
  pause(): void;
  resume(): void;
  subscribe(listener: () => void): () => void;
}

export interface ReadAloudSession {
  title: string;
  artist: string;
  artworkUrl: string | null;
  state: "playing" | "paused";
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export type ReadAloudReport =
  | { event: "started"; control: ReadAloudControl; sentences: number; replay: boolean }
  | { event: "paused" | "resumed" | "stopped" | "completed"; sentences: number }
  | { event: "failed"; sentences: number; reason: "nothing" | "transport" }
  | { event: "refused"; quota: "month" | "day" };

export interface ReadAloudEngineOptions {
  api: () => ChatApi | null;
  createMedia: () => ReadAloudMedia;
  narration: ReadAloudNarration;
  audioUrl: (base64: string) => string;
  releaseUrl: (url: string) => void;
  now: () => number;
  showSession: (session: ReadAloudSession | null) => void;
  report: (report: ReadAloudReport, meta: ReadAloudMeta) => void;
}

interface Clip {
  first: number;
  starts: readonly number[];
  url: string;
}

interface Kept {
  sentences: readonly SentenceOnScreen[];
  clips: readonly Clip[];
}

interface Play {
  answer: AnswerRef;
  meta: ReadAloudMeta;
  sentences: readonly SentenceOnScreen[];
  clips: Clip[];
  at: number;
  arrived: boolean;
  waiting: boolean;
  waitingFor: number;
  stop: AbortController;
}

const KEPT_ANSWERS = 5;
const WARM_EVERY_MS = 20_000;

const IDLE: ReadAloudSnapshot = {
  answer: null,
  status: "idle",
  sentence: null,
  sentences: [],
  problem: null,
  heldNarration: false,
  voiceless: false,
};

export const sameAnswer = (a: AnswerRef | null, b: AnswerRef | null): boolean =>
  a !== null && b !== null && a.chatId === b.chatId && a.message === b.message;

const keyOf = ({ chatId, message }: AnswerRef) => `${chatId}#${message}`;

const problemOf = (error: unknown): ReadAloudProblem | null => {
  if (!(error instanceof SyncRequestError) || error.code !== "too_many_requests") {
    return null;
  }
  const quota = error.details?.quota;
  if (quota !== "chat-month" && quota !== "chat-day") {
    return null;
  }
  const resetsOn = error.details?.resetsOn;
  return { kind: "spent", quota: quota === "chat-day" ? "day" : "month", resetsOn: typeof resetsOn === "string" ? resetsOn : null };
};

// One answer at a time, app-wide: docs/features/chat-read-aloud.md, "The player".
export class ReadAloudEngine {
  #options: ReadAloudEngineOptions;
  #snapshot: ReadAloudSnapshot = IDLE;
  #listeners = new Set<() => void>();
  #media: ReadAloudMedia | null = null;
  #play: Play | null = null;
  #kept = new Map<string, Kept>();
  #warmedAt = Number.NEGATIVE_INFINITY;

  constructor(options: ReadAloudEngineOptions) {
    this.#options = options;
    options.narration.subscribe(() => {
      if (this.#play !== null && options.narration.isPlaying()) {
        this.stop();
      }
      if (this.#snapshot.heldNarration && options.narration.isPlaying()) {
        this.#set({ heldNarration: false });
      }
    });
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): ReadAloudSnapshot => this.#snapshot;

  warm(): void {
    const api = this.#options.api();
    const now = this.#options.now();
    if (api === null || this.#play !== null || now - this.#warmedAt < WARM_EVERY_MS) {
      return;
    }
    this.#warmedAt = now;
    void api
      .warmSpeech()
      .then((hasVoice) => this.#set({ voiceless: !hasVoice }))
      .catch(() => undefined);
  }

  // Called inside the tap, so the browser lets the audio start (docs/features/audio-player.md).
  press(answer: AnswerRef, meta: ReadAloudMeta): void {
    const { status } = this.#snapshot;
    if (sameAnswer(this.#snapshot.answer, answer)) {
      if (status === "paused") {
        this.resume();
      } else {
        this.pause();
      }
      return;
    }
    this.#start(answer, meta);
  }

  pause(): void {
    const play = this.#play;
    if (play === null || this.#snapshot.status === "paused") {
      return;
    }
    if (this.#snapshot.status === "starting") {
      this.stop();
      return;
    }
    this.#media?.pause();
    this.#set({ status: "paused" });
    this.#showSession(play);
    this.#options.report({ event: "paused", sentences: play.sentences.length }, play.meta);
  }

  resume(): void {
    const play = this.#play;
    if (play === null || this.#snapshot.status !== "paused") {
      return;
    }
    this.#holdNarration();
    this.#set({ status: "playing" });
    this.#showSession(play);
    this.#options.report({ event: "resumed", sentences: play.sentences.length }, play.meta);
    if (!play.waiting) {
      void this.#media?.play().catch(() => undefined);
      return;
    }
    this.#continue(play);
  }

  startAgain(): void {
    this.#goToSentence(0);
  }

  nextSentence(): void {
    this.#goToSentence((this.#snapshot.sentence ?? -1) + 1);
  }

  previousSentence(): void {
    this.#goToSentence(Math.max(0, (this.#snapshot.sentence ?? 0) - 1));
  }

  stop(): void {
    const play = this.#play;
    if (play === null) {
      return;
    }
    play.stop.abort();
    this.#media?.pause();
    this.#play = null;
    if (!play.arrived) {
      play.clips.forEach((clip) => this.#options.releaseUrl(clip.url));
    }
    this.#options.report({ event: "stopped", sentences: play.sentences.length }, play.meta);
    this.#options.showSession(null);
    this.#set({ answer: null, status: "idle", sentence: null, sentences: [] });
  }

  dismissProblem(): void {
    this.#set({ problem: null });
  }

  #start(answer: AnswerRef, meta: ReadAloudMeta): void {
    this.stop();
    const media = this.#ensureMedia();
    media.src = silentWavDataUri();
    void media.play().catch(() => undefined);
    const kept = this.#kept.get(keyOf(answer));
    const play: Play = {
      answer,
      meta,
      sentences: kept?.sentences ?? [],
      clips: kept === undefined ? [] : [...kept.clips],
      at: 0,
      arrived: kept !== undefined,
      waiting: true,
      waitingFor: 0,
      stop: new AbortController(),
    };
    this.#play = play;
    this.#holdNarration();
    this.#set({ answer, status: "starting", sentence: null, sentences: play.sentences, problem: null });
    if (kept !== undefined) {
      this.#options.report({ event: "started", control: meta.control, sentences: play.sentences.length, replay: true }, play.meta);
      this.#playClip(play, 0, 0);
      return;
    }
    void this.#fetch(play);
  }

  async #fetch(play: Play): Promise<void> {
    const api = this.#options.api();
    if (api === null) {
      this.#fail(play, "transport");
      return;
    }
    try {
      await api.speak(play.answer.chatId, play.answer.message, (event) => this.#arrive(play, event), play.stop.signal);
    } catch (error) {
      if (play.stop.signal.aborted) {
        return;
      }
      const problem = problemOf(error);
      if (problem !== null && problem.kind === "spent") {
        this.#refuse(play, problem);
        return;
      }
      if (play.clips.length === 0) {
        this.#fail(play, "transport");
        return;
      }
    }
    if (this.#play !== play) {
      return;
    }
    play.arrived = true;
    if (play.clips.length === 0) {
      this.#fail(play, "nothing");
      return;
    }
    this.#keep(play);
    if (play.waiting && this.#snapshot.status === "playing") {
      this.#continue(play);
    }
  }

  #continue(play: Play): void {
    if (play.clips[play.waitingFor] !== undefined) {
      this.#playClip(play, play.waitingFor, 0);
      return;
    }
    if (play.arrived) {
      this.#finish(play);
    }
  }

  #arrive(play: Play, event: ChatSpeechEvent): void {
    if (this.#play !== play) {
      return;
    }
    if (event.type === "sentences") {
      play.sentences = event.sentences;
      this.#set({ sentences: event.sentences });
      this.#options.report({ event: "started", control: play.meta.control, sentences: event.sentences.length, replay: false }, play.meta);
      return;
    }
    if (event.type !== "audio") {
      return;
    }
    play.clips.push({ first: event.first, starts: event.sentenceStartsSeconds, url: this.#options.audioUrl(event.audioBase64) });
    if (play.waiting && this.#snapshot.status !== "paused") {
      this.#continue(play);
    }
  }

  #playClip(play: Play, index: number, seconds: number): void {
    const clip = play.clips[index];
    const media = this.#ensureMedia();
    if (clip === undefined) {
      play.waiting = true;
      play.waitingFor = index;
      return;
    }
    play.at = index;
    play.waiting = false;
    media.src = clip.url;
    media.currentTime = seconds;
    this.#set({
      status: this.#snapshot.status === "paused" ? "paused" : "playing",
      sentence: clip.first + lineAtTime(clip.starts, seconds),
    });
    this.#showSession(play);
    if (this.#snapshot.status === "playing") {
      void media.play().catch(() => undefined);
    }
  }

  #goToSentence(sentence: number): void {
    const play = this.#play;
    if (play === null) {
      return;
    }
    const index = play.clips.reduce((found, clip, at) => (clip.first <= sentence ? at : found), -1);
    const clip = play.clips[index];
    if (clip === undefined) {
      return;
    }
    const within = Math.min(sentence - clip.first, clip.starts.length - 1);
    this.#playClip(play, index, clip.starts[within] ?? 0);
  }

  #ensureMedia(): ReadAloudMedia {
    if (this.#media !== null) {
      return this.#media;
    }
    const media = this.#options.createMedia();
    media.addEventListener("timeupdate", () => {
      const play = this.#play;
      const clip = play?.clips[play.at];
      if (play === undefined || play === null || clip === undefined || play.waiting) {
        return;
      }
      const sentence = clip.first + lineAtTime(clip.starts, media.currentTime);
      if (sentence !== this.#snapshot.sentence) {
        this.#set({ sentence });
      }
    });
    media.addEventListener("ended", () => {
      const play = this.#play;
      if (play === null || play.waiting) {
        return;
      }
      play.waiting = true;
      play.waitingFor = play.at + 1;
      this.#continue(play);
    });
    this.#media = media;
    return media;
  }

  #finish(play: Play): void {
    this.#play = null;
    this.#options.report({ event: "completed", sentences: play.sentences.length }, play.meta);
    this.#options.showSession(null);
    const resumeNarration = this.#snapshot.heldNarration;
    this.#set({ answer: null, status: "idle", sentence: null, sentences: [], heldNarration: false });
    if (resumeNarration) {
      this.#options.narration.resume();
    }
  }

  #fail(play: Play, reason: "nothing" | "transport"): void {
    this.#play = null;
    this.#options.report({ event: "failed", sentences: play.sentences.length, reason }, play.meta);
    this.#options.showSession(null);
    this.#set({
      answer: null,
      status: "idle",
      sentence: null,
      sentences: [],
      problem: { answer: play.answer, problem: { kind: "failed" } },
    });
  }

  #refuse(play: Play, problem: Extract<ReadAloudProblem, { kind: "spent" }>): void {
    this.#play = null;
    this.#options.report({ event: "refused", quota: problem.quota }, play.meta);
    this.#options.showSession(null);
    this.#set({ answer: null, status: "idle", sentence: null, sentences: [], problem: { answer: play.answer, problem } });
  }

  #keep(play: Play): void {
    const key = keyOf(play.answer);
    this.#kept.delete(key);
    this.#kept.set(key, { sentences: play.sentences, clips: play.clips });
    while (this.#kept.size > KEPT_ANSWERS) {
      const [oldest] = this.#kept;
      if (oldest === undefined) {
        break;
      }
      oldest[1].clips.forEach((clip) => this.#options.releaseUrl(clip.url));
      this.#kept.delete(oldest[0]);
    }
  }

  #holdNarration(): void {
    if (this.#options.narration.isPlaying()) {
      this.#options.narration.pause();
      this.#set({ heldNarration: true });
    }
  }

  #showSession(play: Play): void {
    this.#options.showSession({
      title: play.meta.title,
      artist: play.meta.artist,
      artworkUrl: play.meta.artworkUrl,
      state: this.#snapshot.status === "paused" ? "paused" : "playing",
      onPlay: () => this.resume(),
      onPause: () => this.pause(),
      onNext: () => this.nextSentence(),
      onPrevious: () => this.previousSentence(),
    });
  }

  #set(change: Partial<ReadAloudSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...change };
    this.#listeners.forEach((listener) => listener());
  }
}
