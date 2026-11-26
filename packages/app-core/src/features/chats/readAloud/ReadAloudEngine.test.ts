import { describe, expect, it } from "vitest";
import type { ChatSpeechEvent } from "@overview/domain";
import { SyncRequestError, SyncTransportError, type ChatApi } from "@overview/sync";
import { ReadAloudEngine, type ReadAloudReport, type ReadAloudSession } from "./ReadAloudEngine.js";

const ANSWER = { chatId: "chat-1", message: 1 };
const OTHER = { chatId: "chat-1", message: 3 };
const META = { control: "bottom" as const, scope: "library" as const, title: "Chat answer", artist: "Your library", artworkUrl: null };

const sentencesEvent = (count: number): ChatSpeechEvent => ({
  type: "sentences",
  sentences: Array.from({ length: count }, (_, index) => ({
    place: { part: "text" as const },
    block: 0,
    start: index * 10,
    end: index * 10 + 9,
  })),
});

const audioEvent = (first: number, count: number): ChatSpeechEvent => ({
  type: "audio",
  first,
  count,
  sentenceStartsSeconds: Array.from({ length: count }, (_, index) => index * 2),
  durationSeconds: count * 2,
  audioBase64: `clip-${first}`,
});

class FakeMedia {
  src = "";
  currentTime = 0;
  paused = true;
  #listeners = new Map<string, Array<() => void>>();
  play = async () => {
    this.paused = false;
  };
  pause = () => {
    this.paused = true;
  };
  addEventListener = (type: string, listener: () => void) => {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  };
  fire(type: string) {
    this.#listeners.get(type)?.forEach((listener) => listener());
  }
}

interface Speaking {
  send: (event: ChatSpeechEvent) => void;
  end: () => void;
  fail: (error: Error) => void;
  signal: AbortSignal | undefined;
}

const setUp = ({ narrationPlaying = false } = {}) => {
  const media = new FakeMedia();
  const speaking: Speaking[] = [];
  const reports: ReadAloudReport[] = [];
  const sessions: Array<ReadAloudSession | null> = [];
  const narrationListeners = new Set<() => void>();
  const narration = {
    playing: narrationPlaying,
    resumed: 0,
    isPlaying: () => narration.playing,
    pause: () => {
      narration.playing = false;
      narrationListeners.forEach((listener) => listener());
    },
    resume: () => {
      narration.resumed += 1;
    },
    subscribe: (listener: () => void) => {
      narrationListeners.add(listener);
      return () => narrationListeners.delete(listener);
    },
    start: () => {
      narration.playing = true;
      narrationListeners.forEach((listener) => listener());
    },
  };
  let warms = 0;
  let now = 0;
  const api = {
    speak: (_chatId: string, _message: number, onEvent: (event: ChatSpeechEvent) => void, signal?: AbortSignal) =>
      new Promise<void>((resolve, reject) => {
        speaking.push({ send: onEvent, end: resolve, fail: reject, signal });
      }),
    warmSpeech: async () => {
      warms += 1;
      return true;
    },
  } as unknown as ChatApi;
  const engine = new ReadAloudEngine({
    api: () => api,
    createMedia: () => media as unknown as HTMLMediaElement,
    narration,
    audioUrl: (base64) => `blob:${base64}`,
    releaseUrl: () => undefined,
    now: () => now,
    showSession: (session) => sessions.push(session),
    report: (report) => reports.push(report),
  });
  return {
    engine,
    media,
    speaking,
    reports,
    sessions,
    narration,
    warms: () => warms,
    advance: (ms: number) => {
      now += ms;
    },
  };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ReadAloudEngine", () => {
  it("starts at once, plays the first chunk as soon as it arrives, and follows the sentence through the clip", () => {
    const { engine, media, speaking } = setUp();

    engine.press(ANSWER, META);
    expect(engine.getSnapshot()).toMatchObject({ answer: ANSWER, status: "starting" });

    speaking[0]!.send(sentencesEvent(4));
    speaking[0]!.send(audioEvent(0, 1));
    expect(engine.getSnapshot()).toMatchObject({ status: "playing", sentence: 0 });
    expect(media.src).toBe("blob:clip-0");

    speaking[0]!.send(audioEvent(1, 3));
    media.fire("ended");
    expect(media.src).toBe("blob:clip-1");
    media.currentTime = 4.5;
    media.fire("timeupdate");
    expect(engine.getSnapshot().sentence).toBe(3);
  });

  it("waits for a chunk still on its way, then finishes once the last one has played", async () => {
    const { engine, media, speaking, reports } = setUp();
    engine.press(ANSWER, META);
    speaking[0]!.send(sentencesEvent(2));
    speaking[0]!.send(audioEvent(0, 1));

    media.fire("ended");
    expect(engine.getSnapshot()).toMatchObject({ status: "playing", sentence: 0 });
    speaking[0]!.send(audioEvent(1, 1));
    expect(media.src).toBe("blob:clip-1");
    speaking[0]!.send({ type: "done" });
    speaking[0]!.end();
    await settle();
    media.fire("ended");

    expect(engine.getSnapshot()).toMatchObject({ answer: null, status: "idle", sentence: null });
    expect(reports.map((report) => report.event)).toEqual(["started", "completed"]);
  });

  it("pauses and resumes in place, and pressing the same answer toggles between them", () => {
    const { engine, media, speaking } = setUp();
    engine.press(ANSWER, META);
    speaking[0]!.send(sentencesEvent(1));
    speaking[0]!.send(audioEvent(0, 1));

    engine.press(ANSWER, META);
    expect(engine.getSnapshot().status).toBe("paused");
    expect(media.paused).toBe(true);
    engine.press(ANSWER, META);
    expect(engine.getSnapshot().status).toBe("playing");
    expect(media.paused).toBe(false);
  });

  it("pressing while it starts cancels it", () => {
    const { engine, speaking } = setUp();
    engine.press(ANSWER, META);

    engine.press(ANSWER, META);

    expect(engine.getSnapshot().status).toBe("idle");
    expect(speaking[0]!.signal?.aborted).toBe(true);
  });

  it("starting another answer stops the first and drops its place", () => {
    const { engine, speaking } = setUp();
    engine.press(ANSWER, META);
    speaking[0]!.send(audioEvent(0, 1));

    engine.press(OTHER, META);

    expect(speaking[0]!.signal?.aborted).toBe(true);
    expect(engine.getSnapshot()).toMatchObject({ answer: OTHER, status: "starting" });
  });

  it("starts again from the first sentence, and steps a sentence back and forth across chunks", () => {
    const { engine, media, speaking } = setUp();
    engine.press(ANSWER, META);
    speaking[0]!.send(sentencesEvent(4));
    speaking[0]!.send(audioEvent(0, 1));
    speaking[0]!.send(audioEvent(1, 3));

    engine.nextSentence();
    engine.nextSentence();
    expect(engine.getSnapshot().sentence).toBe(2);
    expect(media.src).toBe("blob:clip-1");
    expect(media.currentTime).toBe(2);
    engine.previousSentence();
    engine.previousSentence();
    expect(engine.getSnapshot().sentence).toBe(0);
    engine.nextSentence();
    engine.startAgain();
    expect(media.src).toBe("blob:clip-0");
    expect(engine.getSnapshot().sentence).toBe(0);
  });

  it("a finished answer replays from the device's copy without asking again", async () => {
    const { engine, media, speaking, reports } = setUp();
    engine.press(ANSWER, META);
    speaking[0]!.send(sentencesEvent(1));
    speaking[0]!.send(audioEvent(0, 1));
    speaking[0]!.send({ type: "done" });
    speaking[0]!.end();
    await settle();
    media.fire("ended");

    engine.press(ANSWER, META);

    expect(speaking).toHaveLength(1);
    expect(engine.getSnapshot()).toMatchObject({ status: "playing", sentence: 0 });
    expect(reports.at(-1)).toMatchObject({ event: "started", replay: true });
  });

  it("nothing read says so on that answer, and a refusal says which allowance is spent", async () => {
    const { engine, speaking } = setUp();
    engine.press(ANSWER, META);
    speaking[0]!.fail(new SyncTransportError("The speech stopped arriving"));
    await settle();
    expect(engine.getSnapshot()).toMatchObject({ status: "idle", problem: { answer: ANSWER, problem: { kind: "failed" } } });

    engine.press(OTHER, META);
    speaking[1]!.fail(
      new SyncRequestError("too_many_requests", 429, "You've used this month's chat.", { quota: "chat-month", resetsOn: "2026-12-01" }),
    );
    await settle();
    expect(engine.getSnapshot().problem).toEqual({ answer: OTHER, problem: { kind: "spent", quota: "month", resetsOn: "2026-12-01" } });
  });

  it("holds the overview's narration while it reads and gives it back when the answer ends", async () => {
    const { engine, media, speaking, narration } = setUp({ narrationPlaying: true });

    engine.press(ANSWER, META);
    expect(narration.playing).toBe(false);
    expect(engine.getSnapshot().heldNarration).toBe(true);

    speaking[0]!.send(audioEvent(0, 1));
    speaking[0]!.end();
    await settle();
    media.fire("ended");
    expect(narration.resumed).toBe(1);
    expect(engine.getSnapshot().heldNarration).toBe(false);
  });

  it("narration starting stops the answer", () => {
    const { engine, speaking, narration } = setUp();
    engine.press(ANSWER, META);
    speaking[0]!.send(audioEvent(0, 1));

    narration.start();

    expect(engine.getSnapshot().status).toBe("idle");
  });

  it("shows the lock screen while it reads, with the sentence steps, and clears it after", () => {
    const { engine, speaking, sessions } = setUp();
    engine.press(ANSWER, META);
    speaking[0]!.send(audioEvent(0, 1));

    expect(sessions.at(-1)).toMatchObject({ title: "Chat answer", artist: "Your library", state: "playing" });
    engine.pause();
    expect(sessions.at(-1)).toMatchObject({ state: "paused" });
    engine.stop();
    expect(sessions.at(-1)).toBeNull();
  });

  it("warms the voice at most every twenty seconds, and never while reading", () => {
    const { engine, warms, advance } = setUp();

    engine.warm();
    engine.warm();
    advance(20_000);
    engine.warm();
    engine.press(ANSWER, META);
    advance(20_000);
    engine.warm();

    expect(warms()).toBe(2);
  });
});
