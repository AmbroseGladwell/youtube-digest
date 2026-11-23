import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OverviewId,
  type ClientWarningReport,
  type NarrationRender,
  type NarrationVoice,
  type NoteLine,
  type StreamingNarration,
  MAX_FIRST_SOUND_WAIT_MS,
} from "@overview/domain";
import { SyncRequestError, SyncTransportError, type NarrationApi, type VoicedNarration } from "@overview/sync";
import {
  OPENING_LINE,
  PACER_TICK_MS,
  PREPARING_LONG_AFTER_MS,
  POLL_INTERVAL_MS,
  PlayerEngine,
  STALL_NUDGE_MS,
  STOP_AHEAD_SECONDS,
  STREAM_LEAD_SECONDS,
  streamingTimings,
  WATCH_GIVES_UP_AFTER_MS,
  WATCH_INTERVAL_MS,
  type FirstSoundReport,
  type ListenEndedReport,
  type ListenStartedReport,
  type WaitedAheadReport,
  type PlayerEngineOptions,
  type PlayerMedia,
} from "./PlayerEngine.js";
import type { PlayerTrack } from "./types/PlayerTrack.js";

const KEY = "a".repeat(64);

const line = (section: string, text: string, heading = false): NoteLine => ({
  section,
  heading,
  bullet: false,
  text,
});

const TRACK: PlayerTrack = {
  overviewId: OverviewId.parse("0b8a3b8e-6f7a-4a52-9d2f-1f3c2b8d9e01"),
  title: "The Quiet Return of Nuclear Baseload",
  channel: "Practical Engineering",
  artworkUrl: null,
  opening: null,
  lines: [
    line("Summary", "Premise", true),
    line("Summary", "Three grids are costing reactors back in."),
    line("Key points", "Key points", true),
    line("Key points", "Capacity prices drive the reversal."),
  ],
};

const READY: NarrationRender = {
  key: KEY,
  status: "ready",
  lineStartsSeconds: [0, 1.02, 4.8, 6.1],
  durationSeconds: 9.4,
  fileUrl: `/api/audio/${KEY}/file`,
};

class FakeMedia extends EventTarget implements PlayerMedia {
  src = "";
  #time = 0;
  seeks: number[] = [];
  playbackRate = 1;
  paused = true;
  preload: "" | "none" | "metadata" | "auto" = "";
  blockPlay = false;
  holdSound = false;

  play = (): Promise<void> => {
    if (this.blockPlay) {
      return Promise.reject(new Error("NotAllowedError"));
    }
    this.paused = false;
    if (!this.holdSound) {
      this.sound();
    }
    return Promise.resolve();
  };

  sound = (): void => {
    this.dispatchEvent(new Event("playing"));
  };

  pause = (): void => {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  };

  get currentTime(): number {
    return this.#time;
  }

  set currentTime(seconds: number) {
    this.#time = seconds;
    this.seeks.push(seconds);
  }

  reachTime = (seconds: number) => {
    this.#time = seconds;
    this.dispatchEvent(new Event("timeupdate"));
  };

  end = (): void => {
    this.paused = true;
    this.dispatchEvent(new Event("ended"));
  };
}

const GEORGE_KEY = "b".repeat(64);

const READY_IN_GEORGE: NarrationRender = {
  key: GEORGE_KEY,
  status: "ready",
  lineStartsSeconds: [0, 1.2, 5.3, 6.9],
  durationSeconds: 10.1,
  fileUrl: `/api/audio/${GEORGE_KEY}/file`,
};

const inHeart = (render: NarrationRender): VoicedNarration => ({ voice: "af_heart", render });

const scriptedApi = (overrides: Partial<NarrationApi> = {}): NarrationApi => ({
  peek: vi.fn(async () => null),
  request: vi.fn(async (): Promise<NarrationRender> => ({ key: KEY, status: "queued" })),
  status: vi.fn(async (): Promise<NarrationRender> => READY),
  discard: vi.fn(async () => undefined),
  samples: vi.fn(async () => []),
  fileUrl: (render) => `https://api.test${render.fileUrl}`,
  ...overrides,
});

const settle = () => vi.advanceTimersByTimeAsync(0);

describe("PlayerEngine", () => {
  let media: FakeMedia;
  const engineWith = (api: NarrationApi | null, voice: NarrationVoice = "af_heart", options: Partial<PlayerEngineOptions> = {}) =>
    new PlayerEngine({ api, voice, createMedia: () => (media = new FakeMedia()), ...options });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("with nobody signed in, Listen walks the note as the pacer and says why", async () => {
    const engine = engineWith(null);
    engine.load(TRACK);

    expect(engine.getSnapshot()).toMatchObject({ source: "pacer", pacerReason: "signedOut", status: "ready" });

    engine.play("playerBar");
    await vi.advanceTimersByTimeAsync(1000);

    expect(engine.getSnapshot().status).toBe("playing");
    expect(engine.getTime()).toBeCloseTo(1);
  });

  it("narration that exists is known before the first press, and plays with its measured timings", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }));
    engine.load(TRACK);
    await settle();

    expect(engine.getSnapshot()).toMatchObject({ availability: "ready", source: "audio" });
    expect(engine.getSnapshot().timings.durationSeconds).toBe(9.4);

    engine.play("playerBar");
    expect(media.src).toBe(`https://api.test/api/audio/${KEY}/file`);
    expect(engine.getSnapshot().status).toBe("playing");

    media.reachTime(5);
    expect(engine.getLine()).toBe(2);
  });

  it("a stop after a line pauses just before the next line's first sound, not once it is heard", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }));
    engine.load(TRACK);
    await settle();
    engine.stopAfterLine(0);
    engine.play("playerBar");

    media.reachTime(0.5);
    await vi.advanceTimersByTimeAsync(400);
    expect(engine.getSnapshot().status).toBe("playing");

    media.currentTime = 1.02 - STOP_AHEAD_SECONDS;
    await vi.advanceTimersByTimeAsync(100);
    expect(engine.getSnapshot().status).toBe("paused");
    expect(media.paused).toBe(true);
    expect(engine.getTime()).toBeLessThan(1.02);
    expect(engine.getLine()).toBe(0);
  });

  it("moving the voice while the audio is still finding its place seeks the element once, not again on play", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }));
    engine.load(TRACK);
    await settle();
    engine.play("playerBar");
    engine.seekLine(2);
    media.dispatchEvent(new Event("waiting"));
    expect(engine.getSnapshot().status).toBe("buffering");
    media.seeks = [];

    engine.seekLine(1);
    engine.play("readAloud");

    expect(media.seeks).toEqual([READY.lineStartsSeconds[1]]);
  });

  it("audio stuck waiting with nothing arriving is seeked once to where it is, which starts it again", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }));
    engine.load(TRACK);
    await settle();
    engine.play("playerBar");
    media.reachTime(0.5);
    media.seeks = [];
    media.dispatchEvent(new Event("waiting"));

    await vi.advanceTimersByTimeAsync(STALL_NUDGE_MS - 1);
    expect(media.seeks).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(media.seeks).toEqual([0.5]);

    media.dispatchEvent(new Event("playing"));
    await vi.advanceTimersByTimeAsync(STALL_NUDGE_MS);
    expect(engine.getSnapshot().status).toBe("playing");
    expect(media.seeks).toEqual([0.5]);
  });

  it("audio that waits and then plays on is left alone", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }));
    engine.load(TRACK);
    await settle();
    engine.play("playerBar");
    media.seeks = [];
    media.dispatchEvent(new Event("waiting"));
    await vi.advanceTimersByTimeAsync(STALL_NUDGE_MS / 2);
    media.dispatchEvent(new Event("playing"));

    await vi.advanceTimersByTimeAsync(STALL_NUDGE_MS);
    expect(media.seeks).toEqual([]);
  });

  it("a stop the audio has already passed, between two time updates, pulls it back inside the line", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }));
    engine.load(TRACK);
    await settle();
    engine.stopAfterLine(0);
    engine.play("playerBar");

    media.reachTime(1.2);
    expect(engine.getSnapshot().status).toBe("paused");
    expect(media.currentTime).toBeLessThan(1.02);
    expect(engine.getLine()).toBe(0);
  });

  it("the pacer stops at the line's end too, though it moves in steps", async () => {
    const engine = engineWith(null);
    engine.load(TRACK);
    engine.stopAfterLine(0);
    engine.play("playerBar");

    await vi.advanceTimersByTimeAsync(10_000);
    expect(engine.getSnapshot().status).toBe("paused");
    expect(engine.getLine()).toBe(0);
  });

  it("a stop's timer that fires while the audio is behind waits again rather than cutting the line short", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }));
    engine.load(TRACK);
    await settle();
    engine.stopAfterLine(0);
    engine.play("playerBar");

    media.currentTime = 0.6;
    await vi.advanceTimersByTimeAsync(1000);
    expect(engine.getSnapshot().status).toBe("playing");

    media.reachTime(1.0);
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getSnapshot().status).toBe("paused");
  });

  it("narrates the opening before the first line, with no line on screen standing for it", async () => {
    const opened: PlayerTrack = { ...TRACK, opening: "The Quiet Return of Nuclear Baseload, from Practical Engineering." };
    const withOpening: NarrationRender = { ...READY, lineStartsSeconds: [0, 3.5, 4.5, 8.3, 9.6], durationSeconds: 12.9 };
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(withOpening)) }));
    engine.load(opened);
    await settle();

    engine.play("playerBar");
    expect(engine.getTime()).toBe(0);
    expect(engine.getLine()).toBe(OPENING_LINE);

    media.reachTime(3.6);
    expect(engine.getLine()).toBe(0);

    engine.seekLine(0);
    expect(engine.getTime()).toBe(3.5);
  });

  it("asks for the opening ahead of the lines", async () => {
    const api = scriptedApi();
    const engine = engineWith(api);

    engine.prepare({ ...TRACK, opening: "The Quiet Return of Nuclear Baseload, from Practical Engineering." });
    await settle();

    expect(vi.mocked(api.request).mock.calls[0]![0][0]).toBe("The Quiet Return of Nuclear Baseload, from Practical Engineering.");
  });

  it("still plays narration made before the opening existed, which has an entry per line and no more", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }));
    engine.load({ ...TRACK, opening: "The Quiet Return of Nuclear Baseload, from Practical Engineering." });
    await settle();

    expect(engine.getSnapshot()).toMatchObject({ availability: "ready", source: "audio" });
    expect(engine.getSnapshot().timings.lineStarts).toEqual([0, 1.02, 4.8, 6.1]);
  });

  it("narration nobody has made is asked for on the first press, polled, and played when it lands", async () => {
    const status = vi.fn<NarrationApi["status"]>().mockResolvedValueOnce({ key: KEY, status: "rendering" }).mockResolvedValueOnce(READY);
    const engine = engineWith(scriptedApi({ status }));
    engine.load(TRACK);
    await settle();
    expect(engine.getSnapshot().availability).toBe("onFirstPlay");

    engine.play("playerBar");
    await settle();
    expect(engine.getSnapshot()).toMatchObject({ status: "preparing", preparing: { step: "queued" } });

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(engine.getSnapshot().preparing).toEqual({ step: "rendering", long: false });

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(engine.getSnapshot()).toMatchObject({ status: "playing", source: "audio", preparing: null });
    expect(media.src).toBe(`https://api.test/api/audio/${KEY}/file`);
  });

  it("a long wait offers the pacer meanwhile, and the audio takes over at the line reached", async () => {
    const status = vi.fn<NarrationApi["status"]>().mockResolvedValue({ key: KEY, status: "rendering" });
    const engine = engineWith(scriptedApi({ status }));
    engine.load(TRACK);
    engine.play("playerBar");
    await vi.advanceTimersByTimeAsync(PREPARING_LONG_AFTER_MS);
    expect(engine.getSnapshot().preparing?.long).toBe(true);

    engine.readAlong();
    engine.seekLine(3);
    expect(engine.getSnapshot()).toMatchObject({ source: "pacer", pacerReason: "meanwhile", status: "playing" });

    status.mockResolvedValue(READY);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(engine.getSnapshot()).toMatchObject({ source: "audio", status: "playing", pacerReason: null });
    expect(engine.getLine()).toBe(3);
    expect(media.currentTime).toBe(6.1);
  });

  it("an account with renders already waiting is told so, and pressing play again asks again", async () => {
    const request = vi
      .fn<NarrationApi["request"]>()
      .mockRejectedValueOnce(new SyncRequestError("too_many_requests", 429, "Too much"))
      .mockResolvedValue({ key: KEY, status: "queued" });
    const engine = engineWith(scriptedApi({ request }));
    engine.load(TRACK);
    engine.play("playerBar");
    await settle();
    expect(engine.getSnapshot().status).toBe("busy");

    engine.play("playerBar");
    await settle();
    expect(engine.getSnapshot().status).toBe("preparing");
  });

  it("past the day's new narration it reads along instead, saying why, rather than leaving a dead button", async () => {
    const request = vi
      .fn<NarrationApi["request"]>()
      .mockRejectedValueOnce(
        new SyncRequestError("too_many_requests", 429, "Spent", { quota: "narration-daily", limit: 30, retryAfterSeconds: 3600 }),
      );
    const engine = engineWith(scriptedApi({ request }));
    engine.load(TRACK);
    engine.play("playerBar");
    await settle();

    expect(engine.getSnapshot()).toMatchObject({ source: "pacer", pacerReason: "dailyCap", status: "playing" });
  });

  it("a render that gave up is failed, and reading along instead is the pacer, chosen", async () => {
    const engine = engineWith(scriptedApi({ request: vi.fn(async (): Promise<NarrationRender> => ({ key: KEY, status: "failed" })) }));
    engine.load(TRACK);
    engine.play("playerBar");
    await settle();
    expect(engine.getSnapshot().status).toBe("failed");

    engine.readAlong();
    expect(engine.getSnapshot()).toMatchObject({ source: "pacer", pacerReason: "chosen", status: "playing" });
  });

  it("a server with no narration, or no connection, starts the pacer marked as unavailable", async () => {
    for (const error of [new SyncRequestError("unavailable", 503, "No TTS"), new SyncTransportError("Offline")]) {
      const engine = engineWith(scriptedApi({ request: vi.fn(async () => Promise.reject(error)) }));
      engine.load(TRACK);
      engine.play("playerBar");
      await settle();

      expect(engine.getSnapshot()).toMatchObject({ source: "pacer", pacerReason: "unavailable", status: "playing" });
    }
  });

  it("narration that fell back to the pacer is reported as a warning, with the failed call's id and code", async () => {
    const warnings: ClientWarningReport[] = [];
    const refused = new SyncRequestError("unavailable", 503, "No TTS", undefined, "5f0c2a9e-0000-4000-8000-000000000001");
    for (const api of [
      scriptedApi({ request: vi.fn(async () => Promise.reject(refused)) }),
      scriptedApi({ request: vi.fn(async (): Promise<NarrationRender> => ({ key: KEY, status: "failed" })) }),
    ]) {
      const engine = new PlayerEngine({ api, createMedia: () => new FakeMedia(), warn: (warning) => warnings.push(warning) });
      engine.load(TRACK);
      engine.play("playerBar");
      await settle();
    }

    expect(warnings).toEqual([
      {
        name: "narrationFellBack",
        reason: "requestFailed",
        requestId: "5f0c2a9e-0000-4000-8000-000000000001",
        apiErrorCode: "unavailable",
      },
      { name: "narrationFellBack", reason: "renderFailed" },
    ]);
  });

  it("a session that has ended is not a warning: the pacer is the right answer to it", async () => {
    const warnings: ClientWarningReport[] = [];
    const engine = new PlayerEngine({
      api: scriptedApi({ request: vi.fn(async () => Promise.reject(new SyncRequestError("unauthenticated", 401, "No"))) }),
      createMedia: () => new FakeMedia(),
      warn: (warning) => warnings.push(warning),
    });
    engine.load(TRACK);
    engine.play("playerBar");
    await settle();

    expect(warnings).toEqual([]);
  });

  it("a session that has ended falls back to the pacer as signed out, not as a failure", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => Promise.reject(new SyncRequestError("unauthenticated", 401, "No"))) }));
    engine.load(TRACK);
    await settle();

    expect(engine.getSnapshot()).toMatchObject({ source: "pacer", pacerReason: "signedOut", status: "ready" });
  });

  it("cancelling while preparing goes back to ready, and the render that lands later is ignored", async () => {
    const engine = engineWith(scriptedApi());
    engine.load(TRACK);
    engine.play("playerBar");
    await settle();

    engine.toggle("playerBar");
    expect(engine.getSnapshot()).toMatchObject({ status: "ready", preparing: null });

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(engine.getSnapshot().status).toBe("ready");
  });

  it("skipping moves fifteen seconds and stops at either end", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }));
    engine.load(TRACK);
    await settle();
    engine.play("playerBar");

    engine.skip(15);
    expect(engine.getTime()).toBe(9.4);
    engine.skip(-15);
    expect(engine.getTime()).toBe(0);
    expect(media.currentTime).toBe(0);
  });

  it("the rate is real playback speed, and survives changing note", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }));
    engine.load(TRACK);
    await settle();
    engine.play("playerBar");
    engine.cycleRate();

    expect(media.playbackRate).toBe(1.25);
    engine.load({ ...TRACK, overviewId: OverviewId.parse("0b8a3b8e-6f7a-4a52-9d2f-1f3c2b8d9e02") });
    expect(engine.getSnapshot().rate).toBe(1.25);
  });

  it("a finished note plays again from the start", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }));
    engine.load(TRACK);
    await settle();
    engine.play("playerBar");
    media.dispatchEvent(new Event("ended"));
    expect(engine.getSnapshot().status).toBe("ended");

    engine.play("playerBar");
    expect(engine.getSnapshot().status).toBe("playing");
    expect(media.currentTime).toBe(0);
  });

  it("a play the browser refuses rests as paused rather than claiming to play", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }));
    engine.load(TRACK);
    await settle();
    engine.seekLine(1);
    engine.play("playerBar");
    media.blockPlay = true;
    engine.pause();
    engine.play("playerBar");
    await settle();

    expect(engine.getSnapshot().status).toBe("paused");
  });

  it("narration whose timings do not match the note's lines is not trusted", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart({ ...READY, lineStartsSeconds: [0, 1] })) }));
    engine.load(TRACK);
    await settle();

    expect(engine.getSnapshot().availability).toBe("onFirstPlay");
  });

  it("asks for what each line says rather than what it shows, keeping a silent line in its place", async () => {
    const api = scriptedApi();
    const engine = engineWith(api);

    engine.prepare({
      ...TRACK,
      lines: [
        { ...line("Summary", "Premise", true), spoken: "The premise" },
        line("Summary", "Three grids are costing reactors back in."),
        { ...line("Verdict", "Recycled."), spoken: "" },
        line("Verdict", "Standard advice, e.g. capacity markets."),
      ],
    });
    await settle();

    expect(api.request).toHaveBeenCalledWith(
      ["The premise", "Three grids are costing reactors back in.", "", "Standard advice, for example capacity markets."],
      "af_heart",
      "background",
    );
  });

  it("a note just made asks for its narration in the background, and leaves the player alone", async () => {
    const api = scriptedApi();
    const engine = engineWith(api);
    const before = engine.getSnapshot();

    engine.prepare(TRACK);
    await settle();

    expect(api.request).toHaveBeenCalledOnce();
    expect(api.request).toHaveBeenCalledWith(
      ["Premise", "Three grids are costing reactors back in.", "Key points", "Capacity prices drive the reversal."],
      "af_heart",
      "background",
    );
    expect(engine.getSnapshot()).toBe(before);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(api.status).not.toHaveBeenCalled();
  });

  it("a render already under way is shown preparing, and lands as ready without playing", async () => {
    const status = vi.fn<NarrationApi["status"]>().mockResolvedValueOnce({ key: KEY, status: "rendering" }).mockResolvedValueOnce(READY);
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart({ key: KEY, status: "queued" })), status }));
    engine.load(TRACK);
    await settle();
    expect(engine.getSnapshot()).toMatchObject({
      status: "ready",
      availability: "preparing",
      preparing: { step: "queued", long: false },
    });

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(status).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS - POLL_INTERVAL_MS);
    expect(engine.getSnapshot().preparing?.step).toBe("rendering");

    await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS);
    expect(engine.getSnapshot()).toMatchObject({ status: "ready", availability: "ready", preparing: null });
    expect(engine.getSnapshot().timings.durationSeconds).toBe(9.4);
  });

  it("pressing play on a render already under way asks for it interactively, and plays when it lands", async () => {
    const api = scriptedApi({
      peek: vi.fn(async () => inHeart({ key: KEY, status: "rendering" })),
      request: vi.fn(async (): Promise<NarrationRender> => ({ key: KEY, status: "rendering" })),
    });
    const engine = engineWith(api);
    engine.load(TRACK);
    await settle();

    engine.play("playerBar");
    await settle();
    expect(api.request).toHaveBeenCalledWith(expect.any(Array), "af_heart", "interactive");
    expect(engine.getSnapshot()).toMatchObject({ status: "preparing", preparing: { step: "rendering" } });

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(engine.getSnapshot()).toMatchObject({ status: "playing", source: "audio" });
    expect(api.status).toHaveBeenCalledOnce();
  });

  it("changing track stops watching the last one's render", async () => {
    const api = scriptedApi({ peek: vi.fn(async () => inHeart({ key: KEY, status: "queued" })) });
    const engine = engineWith(api);
    engine.load(TRACK);
    await settle();

    engine.stop();
    await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS * 3);

    expect(api.status).not.toHaveBeenCalled();
    expect(engine.getSnapshot().availability).toBe("checking");
  });

  it("a watched render that fails, or checks that keep failing, go quietly back to made on first play", async () => {
    const failed = engineWith(
      scriptedApi({
        peek: vi.fn(async () => inHeart({ key: KEY, status: "queued" })),
        status: vi.fn(async (): Promise<NarrationRender> => ({ key: KEY, status: "failed" })),
      }),
    );
    failed.load(TRACK);
    await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS);
    expect(failed.getSnapshot()).toMatchObject({ status: "ready", availability: "onFirstPlay", preparing: null });

    const offline = engineWith(
      scriptedApi({
        peek: vi.fn(async () => inHeart({ key: KEY, status: "queued" })),
        status: vi.fn(async () => Promise.reject(new SyncTransportError("Offline"))),
      }),
    );
    offline.load(TRACK);
    await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS * 2);
    expect(offline.getSnapshot().availability).toBe("preparing");
    await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS);
    expect(offline.getSnapshot()).toMatchObject({ status: "ready", source: "audio", availability: "onFirstPlay" });
  });

  it("cancelling a first play goes back to watching the render it asked for", async () => {
    const peek = vi
      .fn<NarrationApi["peek"]>()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(inHeart({ key: KEY, status: "queued" }));
    const engine = engineWith(scriptedApi({ peek }));
    engine.load(TRACK);
    await settle();
    engine.play("playerBar");
    await settle();

    engine.cancel();
    await settle();

    expect(engine.getSnapshot()).toMatchObject({ status: "ready", availability: "preparing" });
  });

  it("cancelling while the connection drops goes back to made on first play, not to the pacer", async () => {
    const peek = vi.fn<NarrationApi["peek"]>().mockResolvedValueOnce(null).mockRejectedValue(new SyncTransportError("Offline"));
    const engine = engineWith(scriptedApi({ peek }));
    engine.load(TRACK);
    await settle();
    engine.play("playerBar");
    await settle();

    engine.cancel();
    await settle();

    expect(engine.getSnapshot()).toMatchObject({ status: "ready", source: "audio", availability: "onFirstPlay" });
  });

  it("a render that never lands stops being watched after two minutes", async () => {
    const api = scriptedApi({
      peek: vi.fn(async () => inHeart({ key: KEY, status: "queued" })),
      status: vi.fn(async (): Promise<NarrationRender> => ({ key: KEY, status: "queued" })),
    });
    const engine = engineWith(api);
    engine.load(TRACK);
    await vi.advanceTimersByTimeAsync(WATCH_GIVES_UP_AFTER_MS - WATCH_INTERVAL_MS);
    expect(engine.getSnapshot().availability).toBe("preparing");

    await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS);
    expect(engine.getSnapshot()).toMatchObject({ status: "ready", availability: "onFirstPlay", preparing: null });

    const checks = vi.mocked(api.status).mock.calls.length;
    await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS * 4);
    expect(api.status).toHaveBeenCalledTimes(checks);
  });

  it("with nobody signed in, a note just made asks for nothing", async () => {
    const engine = engineWith(null);

    expect(() => engine.prepare(TRACK)).not.toThrow();
  });

  it("a background request that is refused changes nothing about what is playing", async () => {
    const request = vi.fn<NarrationApi["request"]>().mockRejectedValueOnce(new SyncRequestError("too_many_requests", 429, "Three waiting"));
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(READY)), request }));
    engine.load(TRACK);
    await settle();
    engine.play("playerBar");
    const playing = engine.getSnapshot();

    engine.prepare({ ...TRACK, lines: TRACK.lines.slice(0, 2) });
    await settle();

    expect(request).toHaveBeenCalledOnce();
    expect(engine.getSnapshot()).toBe(playing);
  });

  describe("old audio (43j)", () => {
    it("a note narrated before the reader chose another voice plays in the voice it was narrated in", async () => {
      const engine = engineWith(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }), "bm_george");
      engine.load(TRACK);
      await settle();

      expect(engine.getSnapshot()).toMatchObject({
        availability: "ready",
        voice: "bm_george",
        narratedVoice: "af_heart",
      });
      engine.play("playerBar");
      expect(media.src).toBe(`https://api.test/api/audio/${KEY}/file`);
    });

    it("re-recording plays the chosen voice from the line reached, then throws the older narration away", async () => {
      const api = scriptedApi({
        peek: vi.fn(async () => inHeart(READY)),
        request: vi.fn(async () => READY_IN_GEORGE),
      });
      const engine = engineWith(api, "bm_george");
      engine.load(TRACK);
      await settle();
      engine.play("playerBar");
      media.reachTime(5);
      engine.pause();

      engine.reRecord();
      await settle();

      expect(api.request).toHaveBeenCalledWith(
        TRACK.lines.map((noteLine) => noteLine.text),
        "bm_george",
        "interactive",
      );
      expect(engine.getSnapshot()).toMatchObject({ status: "playing", narratedVoice: "bm_george" });
      expect(media.src).toBe(`https://api.test/api/audio/${GEORGE_KEY}/file`);
      expect(engine.getTime()).toBe(5.3);
      expect(api.discard).toHaveBeenCalledWith(KEY);
    });

    it("a re-record that is cancelled keeps the older narration", async () => {
      const api = scriptedApi({
        peek: vi.fn(async () => inHeart(READY)),
        request: vi.fn(async (): Promise<NarrationRender> => ({ key: GEORGE_KEY, status: "queued" })),
      });
      const engine = engineWith(api, "bm_george");
      engine.load(TRACK);
      await settle();

      engine.reRecord();
      await settle();
      expect(engine.getSnapshot().status).toBe("preparing");
      engine.cancel();
      await settle();

      expect(engine.getSnapshot()).toMatchObject({ status: "ready", narratedVoice: "af_heart" });
      expect(api.discard).not.toHaveBeenCalled();
    });

    it("re-recording in the voice the note is already narrated in does nothing", async () => {
      const api = scriptedApi({ peek: vi.fn(async () => inHeart(READY)) });
      const engine = engineWith(api, "af_heart");
      engine.load(TRACK);
      await settle();

      engine.reRecord();
      await settle();

      expect(api.request).not.toHaveBeenCalled();
    });

    it("choosing another voice looks an unplayed note up again in it", async () => {
      const api = scriptedApi({ peek: vi.fn(async () => inHeart(READY)) });
      const engine = engineWith(api, "af_heart");
      engine.load(TRACK);
      await settle();

      engine.setVoice("bf_emma");
      await settle();

      expect(api.peek).toHaveBeenLastCalledWith(
        TRACK.lines.map((noteLine) => noteLine.text),
        "bf_emma",
      );
      expect(engine.getSnapshot()).toMatchObject({ voice: "bf_emma", narratedVoice: "af_heart" });
    });

    it("choosing another voice while a note plays leaves it playing", async () => {
      const api = scriptedApi({ peek: vi.fn(async () => inHeart(READY)) });
      const engine = engineWith(api, "af_heart");
      engine.load(TRACK);
      await settle();
      engine.play("playerBar");

      engine.setVoice("bf_emma");
      await settle();

      expect(api.peek).toHaveBeenCalledTimes(1);
      expect(engine.getSnapshot()).toMatchObject({ status: "playing", voice: "bf_emma", narratedVoice: "af_heart" });
    });
  });
  describe("playing while it renders", () => {
    const PLAYLIST = `https://api.test/api/audio/${KEY}/playlist.m3u8`;
    const streaming = (renderedSeconds: number, lineStartsSeconds: number[]): StreamingNarration => ({
      key: KEY,
      status: "rendering",
      lineStartsSeconds,
      renderedSeconds,
      playlistUrl: `/api/audio/${KEY}/playlist.m3u8`,
    });
    const FIRST_LINES = streaming(5.5, [0, 1.02, 4.8]);
    const ALL_LINES = streaming(9.4, [0, 1.02, 4.8, 6.1]);

    const pressedWith = async (statuses: NarrationRender[], options: Partial<PlayerEngineOptions> = {}) => {
      const status = vi.fn<NarrationApi["status"]>();
      for (const answer of statuses) {
        status.mockResolvedValueOnce(answer);
      }
      status.mockResolvedValue(statuses.at(-1)!);
      const engine = engineWith(scriptedApi({ status }), "af_heart", options);
      engine.load(TRACK);
      await settle();
      engine.play("playerBar");
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      return engine;
    };

    it("a first play starts on the playlist once a lead is rendered, without waiting for the file", async () => {
      const engine = await pressedWith([FIRST_LINES]);

      expect(media.src).toBe(PLAYLIST);
      expect(engine.getSnapshot()).toMatchObject({
        status: "playing",
        source: "audio",
        stream: { renderedSeconds: 5.5, holdingLine: null },
      });
      expect(engine.getSnapshot().timings.lineStarts.slice(0, 3)).toEqual([0, 1.02, 4.8]);
    });

    it("less than the lead keeps preparing", async () => {
      const engine = await pressedWith([streaming(STREAM_LEAD_SECONDS - 1, [0, 1.02])]);

      expect(engine.getSnapshot().status).toBe("preparing");
      expect(media.src).not.toBe(PLAYLIST);
    });

    it("lines not yet rendered are placed after those that are, at their pace, and the length covers what is rendered", () => {
      const timings = streamingTimings(FIRST_LINES, TRACK);

      expect(timings.lineStarts.slice(0, 3)).toEqual([0, 1.02, 4.8]);
      expect(timings.lineStarts[3]).toBeGreaterThan(4.8);
      expect(timings.durationSeconds).toBeGreaterThanOrEqual(5.5);
    });

    it("the render finishing mid-listen brings the file's timings, and the playlist plays on to its end", async () => {
      const engine = await pressedWith([FIRST_LINES, READY]);

      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(engine.getSnapshot()).toMatchObject({
        status: "playing",
        stream: null,
        timings: { lineStarts: [0, 1.02, 4.8, 6.1], durationSeconds: 9.4 },
      });
      expect(media.src).toBe(PLAYLIST);
    });

    it("playing again after the end plays the stored file", async () => {
      const engine = await pressedWith([FIRST_LINES, READY]);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      media.reachTime(0.4);
      media.reachTime(9.4);
      media.end();
      engine.play("playerBar");

      expect(media.src).toBe(`https://api.test/api/audio/${KEY}/file`);
    });

    it("moving past what is rendered holds on that line, then plays from it once it is rendered", async () => {
      const waited = vi.fn<(report: WaitedAheadReport) => void>();
      const engine = await pressedWith([FIRST_LINES, FIRST_LINES, ALL_LINES], { onWaitedAhead: waited });

      engine.seekLine(3);
      const held = engine.getSnapshot();
      const heldLine = engine.getLine();
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(engine.getSnapshot().status).toBe("buffering");
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(held).toMatchObject({ status: "buffering", stream: { holdingLine: 3 } });
      expect(heldLine).toBe(3);
      expect(media.seeks.at(-1)).toBe(6.1);
      expect(engine.getSnapshot()).toMatchObject({ status: "playing", stream: { holdingLine: null } });
      expect(waited).toHaveBeenCalledExactlyOnceWith({ overviewId: TRACK.overviewId, waitMs: POLL_INTERVAL_MS * 2, outcome: "played" });
    });

    it("moving back into what is rendered while held lets the hold go and plays from there", async () => {
      const waited = vi.fn<(report: WaitedAheadReport) => void>();
      const engine = await pressedWith([FIRST_LINES], { onWaitedAhead: waited });

      engine.seekLine(3);
      engine.seekLine(1);

      expect(engine.getSnapshot()).toMatchObject({ status: "playing", stream: { holdingLine: null } });
      expect(media.seeks.at(-1)).toBe(1.02);
      expect(waited).toHaveBeenCalledExactlyOnceWith({ overviewId: TRACK.overviewId, waitMs: 0, outcome: "abandoned" });
    });

    it("the held line's position from the element is ignored while it waits", async () => {
      const engine = await pressedWith([FIRST_LINES]);

      engine.seekLine(3);
      media.reachTime(2);

      expect(engine.getLine()).toBe(3);
    });

    it("a playlist that reports its end while the render is still going is waited on, not ended", async () => {
      const engine = await pressedWith([FIRST_LINES]);

      media.reachTime(5.4);
      media.end();

      expect(engine.getSnapshot().status).toBe("buffering");
      expect(media.paused).toBe(false);
    });

    it("a playlist that reports its end well short of the finished length is waited on, not ended", async () => {
      const engine = await pressedWith([FIRST_LINES, READY]);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      media.reachTime(5.4);
      media.end();

      expect(engine.getSnapshot().status).toBe("buffering");
    });

    it("a playlist the element starts near its end, as Safari does, is moved back to where the listen meant to start", async () => {
      const engine = await pressedWith([FIRST_LINES]);
      const seeksBefore = media.seeks.length;

      media.reachTime(3.5);
      media.reachTime(0.4);
      media.reachTime(3.5);

      expect(media.seeks.slice(seeksBefore)).toEqual([0]);
      expect(engine.getSnapshot().status).toBe("playing");
      expect(engine.getTime()).toBe(3.5);
    });

    it("a playlist that starts where it was meant to is left alone once it is moving", async () => {
      await pressedWith([FIRST_LINES]);
      const seeksBefore = media.seeks.length;

      media.reachTime(0.4);
      media.reachTime(4);

      expect(media.seeks.slice(seeksBefore)).toEqual([]);
    });

    it("first sound from a playlist says it streamed", async () => {
      const heard = vi.fn<(report: FirstSoundReport) => void>();
      await pressedWith([FIRST_LINES], { onFirstSound: heard });

      expect(heard).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ prepared: true, streamed: true, source: "audio" }));
    });

    it("a render that gives up while it streams is a failed render", async () => {
      const engine = await pressedWith([FIRST_LINES, { key: KEY, status: "failed" }]);

      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(engine.getSnapshot()).toMatchObject({ status: "failed", stream: null });
    });

    it("the playlist is handed to the loader given, which is released when the file takes over", async () => {
      const released = vi.fn();
      const loadStream = vi.fn((target: PlayerMedia, url: string) => {
        target.src = `blob:${url}`;
        return released;
      });
      const engine = await pressedWith([FIRST_LINES, READY], { loadStream });
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      media.reachTime(0.4);
      media.reachTime(9.4);
      media.end();
      engine.play("playerBar");

      expect(loadStream).toHaveBeenCalledWith(media, PLAYLIST, expect.any(Function));
      expect(released).toHaveBeenCalledOnce();
    });
  });

  describe("time to first sound", () => {
    const timed = (api: NarrationApi | null, { holdSound = false } = {}) => {
      const heard = vi.fn<(report: FirstSoundReport) => void>();
      const createMedia = () => {
        media = new FakeMedia();
        media.holdSound = holdSound;
        return media;
      };
      const engine = engineWith(api, "af_heart", { onFirstSound: heard, now: () => Date.now(), createMedia });
      return { engine, heard };
    };

    it("narration that was ready is timed from the press to the element's first sound, as not prepared", async () => {
      const { engine, heard } = timed(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }), { holdSound: true });
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      await vi.advanceTimersByTimeAsync(320);
      expect(heard).not.toHaveBeenCalled();
      media.sound();

      expect(heard).toHaveBeenCalledExactlyOnceWith({
        overviewId: TRACK.overviewId,
        waitMs: 320,
        from: "playerBar",
        source: "audio",
        prepared: false,
        streamed: false,
      });
    });

    it("narration made on the press is timed through the polls that found it, as prepared", async () => {
      const status = vi.fn<NarrationApi["status"]>().mockResolvedValueOnce({ key: KEY, status: "rendering" }).mockResolvedValueOnce(READY);
      const { engine, heard } = timed(scriptedApi({ status }));
      engine.load(TRACK);
      await settle();

      engine.play("masthead");
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);

      expect(engine.getSnapshot().status).toBe("playing");
      expect(heard).toHaveBeenCalledExactlyOnceWith({
        overviewId: TRACK.overviewId,
        waitMs: POLL_INTERVAL_MS * 2,
        from: "masthead",
        source: "audio",
        prepared: true,
        streamed: false,
      });
    });

    it("the pacer's first tick is its first sound", async () => {
      const { engine, heard } = timed(null);
      engine.load(TRACK);

      engine.play("libraryRow");
      await vi.advanceTimersByTimeAsync(PACER_TICK_MS * 3);

      expect(heard).toHaveBeenCalledExactlyOnceWith({
        overviewId: TRACK.overviewId,
        waitMs: PACER_TICK_MS,
        from: "libraryRow",
        source: "pacer",
        prepared: false,
        streamed: false,
      });
    });

    it("reading along meanwhile ends the wait at the pacer, and the audio landing later is not a second one", async () => {
      const status = vi.fn<NarrationApi["status"]>().mockResolvedValue({ key: KEY, status: "rendering" });
      const { engine, heard } = timed(scriptedApi({ status }));
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      await vi.advanceTimersByTimeAsync(PREPARING_LONG_AFTER_MS);
      engine.readAlong();
      await vi.advanceTimersByTimeAsync(PACER_TICK_MS);
      status.mockResolvedValue(READY);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(engine.getSnapshot()).toMatchObject({ source: "audio", status: "playing" });
      expect(heard).toHaveBeenCalledExactlyOnceWith({
        overviewId: TRACK.overviewId,
        waitMs: PREPARING_LONG_AFTER_MS + PACER_TICK_MS,
        from: "playerBar",
        source: "pacer",
        prepared: true,
        streamed: false,
      });
    });

    it("a press paused before any sound sends nothing, even once the sound comes", async () => {
      const { engine, heard } = timed(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }), { holdSound: true });
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      await vi.advanceTimersByTimeAsync(100);
      engine.pause();
      media.sound();

      expect(heard).not.toHaveBeenCalled();
    });

    it("a press cancelled while preparing sends nothing, even when the render lands", async () => {
      const status = vi.fn<NarrationApi["status"]>().mockResolvedValue({ key: KEY, status: "rendering" });
      const { engine, heard } = timed(scriptedApi({ status }));
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      await settle();
      expect(engine.getSnapshot().status).toBe("preparing");
      engine.cancel();
      status.mockResolvedValue(READY);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);

      expect(heard).not.toHaveBeenCalled();
    });

    it("a listen carried on from paused is not timed again", async () => {
      const { engine, heard } = timed(scriptedApi({ peek: vi.fn(async () => inHeart(READY)) }));
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      engine.pause();
      engine.play("playerBar");

      expect(heard).toHaveBeenCalledTimes(1);
    });

    it("a wait is capped, so one render nobody should have sat through does not skew the rest", async () => {
      const status = vi.fn<NarrationApi["status"]>().mockResolvedValue({ key: KEY, status: "rendering" });
      const { engine, heard } = timed(scriptedApi({ status }));
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      await vi.advanceTimersByTimeAsync(MAX_FIRST_SOUND_WAIT_MS + POLL_INTERVAL_MS);
      status.mockResolvedValue(READY);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);

      expect(heard).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ waitMs: MAX_FIRST_SOUND_WAIT_MS, prepared: true }));
    });
  });

  describe("how far a listen got", () => {
    const OPENING = "The Quiet Return of Nuclear Baseload, from Practical Engineering.";
    const OPENED: PlayerTrack = { ...TRACK, opening: OPENING };
    const READY_WITH_OPENING: NarrationRender = { ...READY, lineStartsSeconds: [0, 3.5, 4.5, 8.3, 9.6], durationSeconds: 12.9 };
    const OTHER_TRACK: PlayerTrack = { ...TRACK, overviewId: OverviewId.parse("5d1e7c3a-2b4f-4c6d-8e9f-0a1b2c3d4e5f") };

    const counted = (api: NarrationApi | null) => {
      const started = vi.fn<(report: ListenStartedReport) => void>();
      const ended = vi.fn<(report: ListenEndedReport) => void>();
      const engine = engineWith(api, "af_heart", { onListenStarted: started, onListenEnded: ended });
      return { engine, started, ended };
    };

    const ready = (render: NarrationRender) => scriptedApi({ peek: vi.fn(async () => inHeart(render)) });

    it("a listen played to its end is finished with all of it heard, and says the narration had its opening", async () => {
      const { engine, started, ended } = counted(ready(READY_WITH_OPENING));
      engine.load(OPENED);
      await settle();

      engine.play("playerBar");
      media.reachTime(3);
      media.reachTime(8);
      media.reachTime(12.7);
      media.end();

      expect(started).toHaveBeenCalledExactlyOnceWith({ overviewId: TRACK.overviewId, source: "audio" });
      expect(ended).toHaveBeenCalledExactlyOnceWith({
        overviewId: TRACK.overviewId,
        source: "audio",
        percentHeard: 100,
        reason: "finished",
        withOpening: true,
      });
      expect(engine.getSnapshot().status).toBe("ended");
    });

    it("narration made before the opening existed is counted without one", async () => {
      const { engine, ended } = counted(ready(READY));
      engine.load(OPENED);
      await settle();

      engine.play("playerBar");
      media.reachTime(9);
      media.end();

      expect(ended).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ reason: "finished", withOpening: false }));
    });

    it("stopping part way counts what was heard, in whole tens", async () => {
      const { engine, ended } = counted(ready(READY));
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      media.reachTime(1);
      media.reachTime(2.8);
      engine.stop();

      expect(ended).toHaveBeenCalledExactlyOnceWith({
        overviewId: TRACK.overviewId,
        source: "audio",
        percentHeard: 30,
        reason: "stopped",
        withOpening: false,
      });
    });

    it("a note left paused on its page is not docked, and one left playing is, until it stops", async () => {
      const { engine } = counted(ready(READY));
      engine.notePageOpened(TRACK.overviewId);
      engine.load(TRACK);
      await settle();
      engine.play("playerBar");
      expect(engine.getSnapshot().docked).toBe(false);

      engine.pause();
      engine.notePageClosed(TRACK.overviewId);
      expect(engine.getSnapshot().docked).toBe(false);

      engine.notePageOpened(TRACK.overviewId);
      engine.play("playerBar");
      engine.notePageClosed(TRACK.overviewId);
      expect(engine.getSnapshot().docked).toBe(true);

      engine.pause();
      expect(engine.getSnapshot().docked).toBe(true);

      engine.notePageOpened(TRACK.overviewId);
      expect(engine.getSnapshot().docked).toBe(false);
      engine.notePageClosed(TRACK.overviewId);
      engine.play("playerBar");
      engine.stop();
      expect(engine.getSnapshot().docked).toBe(false);
    });

    it("a note played from off its page is docked, and another note's page leaves it docked", async () => {
      const { engine } = counted(ready(READY));
      engine.load(TRACK);
      await settle();
      engine.play("libraryRow");
      expect(engine.getSnapshot().docked).toBe(true);

      engine.notePageOpened(OTHER_TRACK.overviewId);
      engine.pause();
      expect(engine.getSnapshot().docked).toBe(true);
    });

    it("signing out ends the listen as signed out, once, and puts the note away", async () => {
      const { engine, ended } = counted(ready(READY));
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      media.reachTime(2);
      engine.endSession();
      engine.endSession();

      expect(ended).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ reason: "signedOut", percentHeard: 20 }));
      expect(engine.getSnapshot().track).toBeNull();
      expect(engine.getSnapshot().status).toBe("ready");
    });

    it("loading another note ends the listen as switched, and the other note's listen is its own", async () => {
      const { engine, started, ended } = counted(ready(READY));
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      media.reachTime(4.7);
      engine.load(OTHER_TRACK);
      await settle();

      expect(ended).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ overviewId: TRACK.overviewId, percentHeard: 50, reason: "switchedNote" }),
      );

      engine.play("libraryRow");
      expect(started).toHaveBeenCalledTimes(2);
      expect(started).toHaveBeenLastCalledWith({ overviewId: OTHER_TRACK.overviewId, source: "audio" });
    });

    it("a stretch skipped over is not counted as heard, even when the end is reached", async () => {
      const { engine, ended } = counted(ready(READY));
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      media.reachTime(1);
      engine.seek(6);
      media.reachTime(6);
      media.reachTime(7);
      media.reachTime(9.3);
      media.end();

      expect(ended).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ percentHeard: 50, reason: "finished" }));
    });

    it("a stretch heard twice is counted once", async () => {
      const { engine, ended } = counted(ready(READY));
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      media.reachTime(4);
      engine.seek(0);
      media.reachTime(0);
      media.reachTime(4);
      engine.stop();

      expect(ended).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ percentHeard: 40 }));
    });

    it("a play carried on from paused is the same listen, not another", async () => {
      const { engine, started, ended } = counted(ready(READY));
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      media.reachTime(2);
      engine.pause();
      engine.play("playerBar");
      media.reachTime(4);
      engine.stop();

      expect(started).toHaveBeenCalledTimes(1);
      expect(ended).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ percentHeard: 40, reason: "stopped" }));
    });

    it("the pacer's listen is counted too, on its own clock and with no opening", async () => {
      const { engine, started, ended } = counted(null);
      engine.load(TRACK);

      engine.play("playerBar");
      await vi.advanceTimersByTimeAsync(120_000);

      expect(started).toHaveBeenCalledExactlyOnceWith({ overviewId: TRACK.overviewId, source: "pacer" });
      expect(ended).toHaveBeenCalledExactlyOnceWith({
        overviewId: TRACK.overviewId,
        source: "pacer",
        percentHeard: 100,
        reason: "finished",
        withOpening: false,
      });
    });

    it("reading along meanwhile and the audio landing is one listen, begun on the pacer and ended on the audio", async () => {
      const status = vi.fn<NarrationApi["status"]>().mockResolvedValue({ key: KEY, status: "rendering" });
      const { engine, started, ended } = counted(scriptedApi({ status }));
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      await vi.advanceTimersByTimeAsync(PREPARING_LONG_AFTER_MS);
      engine.readAlong();
      await vi.advanceTimersByTimeAsync(PACER_TICK_MS * 4);
      status.mockResolvedValue(READY);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      media.reachTime(9);
      media.end();

      expect(started).toHaveBeenCalledExactlyOnceWith({ overviewId: TRACK.overviewId, source: "pacer" });
      expect(ended).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ source: "audio", reason: "finished", withOpening: false }));
      const { percentHeard } = ended.mock.calls[0]![0];
      expect(percentHeard % 10).toBe(0);
      expect(percentHeard).toBeGreaterThan(0);
    });

    it("the page going out of sight leaves a listen still playing alone, and ends a paused one as left", async () => {
      const { engine, started, ended } = counted(ready(READY));
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      media.reachTime(2);
      engine.pageHidden();
      expect(ended).not.toHaveBeenCalled();

      engine.pause();
      engine.pageHidden();
      expect(ended).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ percentHeard: 20, reason: "left" }));

      engine.play("playerBar");
      expect(started).toHaveBeenCalledTimes(2);
    });

    it("the page closing ends a listen still playing as left", async () => {
      const { engine, ended } = counted(ready(READY));
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      media.reachTime(3);
      engine.pageLeft();

      expect(ended).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ percentHeard: 30, reason: "left" }));
    });

    it("a press that made no sound is no listen, so nothing is ended", async () => {
      const status = vi.fn<NarrationApi["status"]>().mockResolvedValue({ key: KEY, status: "rendering" });
      const { engine, started, ended } = counted(scriptedApi({ status }));
      engine.load(TRACK);
      await settle();

      engine.play("playerBar");
      await settle();
      engine.cancel();
      engine.stop();

      expect(started).not.toHaveBeenCalled();
      expect(ended).not.toHaveBeenCalled();
    });
  });
});
