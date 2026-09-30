import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OverviewId, type NarrationRender, type NoteLine } from "@overview/domain";
import { SyncRequestError, SyncTransportError, type NarrationApi } from "@overview/sync";
import {
  PREPARING_LONG_AFTER_MS,
  POLL_INTERVAL_MS,
  PlayerEngine,
  WATCH_GIVES_UP_AFTER_MS,
  WATCH_INTERVAL_MS,
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
  currentTime = 0;
  playbackRate = 1;
  paused = true;
  preload: "" | "none" | "metadata" | "auto" = "";
  blockPlay = false;

  play = (): Promise<void> => {
    if (this.blockPlay) return Promise.reject(new Error("NotAllowedError"));
    this.paused = false;
    this.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  };

  pause = (): void => {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  };

  reachTime = (seconds: number) => {
    this.currentTime = seconds;
    this.dispatchEvent(new Event("timeupdate"));
  };
}

const scriptedApi = (overrides: Partial<NarrationApi> = {}): NarrationApi => ({
  peek: vi.fn(async () => null),
  request: vi.fn(async (): Promise<NarrationRender> => ({ key: KEY, status: "queued" })),
  status: vi.fn(async (): Promise<NarrationRender> => READY),
  fileUrl: (render) => `https://api.test${render.fileUrl}`,
  ...overrides,
});

const settle = () => vi.advanceTimersByTimeAsync(0);

describe("PlayerEngine", () => {
  let media: FakeMedia;
  const engineWith = (api: NarrationApi | null) =>
    new PlayerEngine({ api, createMedia: () => (media = new FakeMedia()) });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("with nobody signed in, Listen walks the note as the pacer and says why", async () => {
    const engine = engineWith(null);
    engine.load(TRACK);

    expect(engine.getSnapshot()).toMatchObject({ source: "pacer", pacerReason: "signedOut", status: "ready" });

    engine.play();
    await vi.advanceTimersByTimeAsync(1000);

    expect(engine.getSnapshot().status).toBe("playing");
    expect(engine.getTime()).toBeCloseTo(1);
  });

  it("narration that exists is known before the first press, and plays with its measured timings", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => READY) }));
    engine.load(TRACK);
    await settle();

    expect(engine.getSnapshot()).toMatchObject({ availability: "ready", source: "audio" });
    expect(engine.getSnapshot().timings.durationSeconds).toBe(9.4);

    engine.play();
    expect(media.src).toBe(`https://api.test/api/audio/${KEY}/file`);
    expect(engine.getSnapshot().status).toBe("playing");

    media.reachTime(5);
    expect(engine.getLine()).toBe(2);
  });

  it("narration nobody has made is asked for on the first press, polled, and played when it lands", async () => {
    const status = vi
      .fn<NarrationApi["status"]>()
      .mockResolvedValueOnce({ key: KEY, status: "rendering" })
      .mockResolvedValueOnce(READY);
    const engine = engineWith(scriptedApi({ status }));
    engine.load(TRACK);
    await settle();
    expect(engine.getSnapshot().availability).toBe("onFirstPlay");

    engine.play();
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
    engine.play();
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
    engine.play();
    await settle();
    expect(engine.getSnapshot().status).toBe("busy");

    engine.play();
    await settle();
    expect(engine.getSnapshot().status).toBe("preparing");
  });

  it("a render that gave up is failed, and reading along instead is the pacer, chosen", async () => {
    const engine = engineWith(
      scriptedApi({ request: vi.fn(async (): Promise<NarrationRender> => ({ key: KEY, status: "failed" })) }),
    );
    engine.load(TRACK);
    engine.play();
    await settle();
    expect(engine.getSnapshot().status).toBe("failed");

    engine.readAlong();
    expect(engine.getSnapshot()).toMatchObject({ source: "pacer", pacerReason: "chosen", status: "playing" });
  });

  it("a server with no narration, or no connection, starts the pacer marked as unavailable", async () => {
    for (const error of [new SyncRequestError("unavailable", 503, "No TTS"), new SyncTransportError("Offline")]) {
      const engine = engineWith(scriptedApi({ request: vi.fn(async () => Promise.reject(error)) }));
      engine.load(TRACK);
      engine.play();
      await settle();

      expect(engine.getSnapshot()).toMatchObject({ source: "pacer", pacerReason: "unavailable", status: "playing" });
    }
  });

  it("a session that has ended falls back to the pacer as signed out, not as a failure", async () => {
    const engine = engineWith(
      scriptedApi({ peek: vi.fn(async () => Promise.reject(new SyncRequestError("unauthenticated", 401, "No"))) }),
    );
    engine.load(TRACK);
    await settle();

    expect(engine.getSnapshot()).toMatchObject({ source: "pacer", pacerReason: "signedOut", status: "ready" });
  });

  it("cancelling while preparing goes back to ready, and the render that lands later is ignored", async () => {
    const engine = engineWith(scriptedApi());
    engine.load(TRACK);
    engine.play();
    await settle();

    engine.toggle();
    expect(engine.getSnapshot()).toMatchObject({ status: "ready", preparing: null });

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(engine.getSnapshot().status).toBe("ready");
  });

  it("skipping moves fifteen seconds and stops at either end", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => READY) }));
    engine.load(TRACK);
    await settle();
    engine.play();

    engine.skip(15);
    expect(engine.getTime()).toBe(9.4);
    engine.skip(-15);
    expect(engine.getTime()).toBe(0);
    expect(media.currentTime).toBe(0);
  });

  it("the rate is real playback speed, and survives changing note", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => READY) }));
    engine.load(TRACK);
    await settle();
    engine.play();
    engine.cycleRate();

    expect(media.playbackRate).toBe(1.25);
    engine.load({ ...TRACK, overviewId: OverviewId.parse("0b8a3b8e-6f7a-4a52-9d2f-1f3c2b8d9e02") });
    expect(engine.getSnapshot().rate).toBe(1.25);
  });

  it("a finished note plays again from the start", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => READY) }));
    engine.load(TRACK);
    await settle();
    engine.play();
    media.dispatchEvent(new Event("ended"));
    expect(engine.getSnapshot().status).toBe("ended");

    engine.play();
    expect(engine.getSnapshot().status).toBe("playing");
    expect(media.currentTime).toBe(0);
  });

  it("a play the browser refuses rests as paused rather than claiming to play", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => READY) }));
    engine.load(TRACK);
    await settle();
    engine.seekLine(1);
    engine.play();
    media.blockPlay = true;
    engine.pause();
    engine.play();
    await settle();

    expect(engine.getSnapshot().status).toBe("paused");
  });

  it("narration whose timings do not match the note's lines is not trusted", async () => {
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => ({ ...READY, lineStartsSeconds: [0, 1] })) }));
    engine.load(TRACK);
    await settle();

    expect(engine.getSnapshot().availability).toBe("onFirstPlay");
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
    const status = vi
      .fn<NarrationApi["status"]>()
      .mockResolvedValueOnce({ key: KEY, status: "rendering" })
      .mockResolvedValueOnce(READY);
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => ({ key: KEY, status: "queued" as const })), status }));
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
      peek: vi.fn(async () => ({ key: KEY, status: "rendering" as const })),
      request: vi.fn(async (): Promise<NarrationRender> => ({ key: KEY, status: "rendering" })),
    });
    const engine = engineWith(api);
    engine.load(TRACK);
    await settle();

    engine.play();
    await settle();
    expect(api.request).toHaveBeenCalledWith(expect.any(Array), "af_heart", "interactive");
    expect(engine.getSnapshot()).toMatchObject({ status: "preparing", preparing: { step: "rendering" } });

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(engine.getSnapshot()).toMatchObject({ status: "playing", source: "audio" });
    expect(api.status).toHaveBeenCalledOnce();
  });

  it("changing track stops watching the last one's render", async () => {
    const api = scriptedApi({ peek: vi.fn(async () => ({ key: KEY, status: "queued" as const })) });
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
        peek: vi.fn(async () => ({ key: KEY, status: "queued" as const })),
        status: vi.fn(async (): Promise<NarrationRender> => ({ key: KEY, status: "failed" })),
      }),
    );
    failed.load(TRACK);
    await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS);
    expect(failed.getSnapshot()).toMatchObject({ status: "ready", availability: "onFirstPlay", preparing: null });

    const offline = engineWith(
      scriptedApi({
        peek: vi.fn(async () => ({ key: KEY, status: "queued" as const })),
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
    const peek = vi.fn<NarrationApi["peek"]>().mockResolvedValueOnce(null).mockResolvedValue({ key: KEY, status: "queued" });
    const engine = engineWith(scriptedApi({ peek }));
    engine.load(TRACK);
    await settle();
    engine.play();
    await settle();

    engine.cancel();
    await settle();

    expect(engine.getSnapshot()).toMatchObject({ status: "ready", availability: "preparing" });
  });

  it("cancelling while the connection drops goes back to made on first play, not to the pacer", async () => {
    const peek = vi
      .fn<NarrationApi["peek"]>()
      .mockResolvedValueOnce(null)
      .mockRejectedValue(new SyncTransportError("Offline"));
    const engine = engineWith(scriptedApi({ peek }));
    engine.load(TRACK);
    await settle();
    engine.play();
    await settle();

    engine.cancel();
    await settle();

    expect(engine.getSnapshot()).toMatchObject({ status: "ready", source: "audio", availability: "onFirstPlay" });
  });

  it("a render that never lands stops being watched after two minutes", async () => {
    const api = scriptedApi({
      peek: vi.fn(async () => ({ key: KEY, status: "queued" as const })),
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
    const request = vi
      .fn<NarrationApi["request"]>()
      .mockRejectedValueOnce(new SyncRequestError("too_many_requests", 429, "Three waiting"));
    const engine = engineWith(scriptedApi({ peek: vi.fn(async () => READY), request }));
    engine.load(TRACK);
    await settle();
    engine.play();
    const playing = engine.getSnapshot();

    engine.prepare({ ...TRACK, lines: TRACK.lines.slice(0, 2) });
    await settle();

    expect(request).toHaveBeenCalledOnce();
    expect(engine.getSnapshot()).toBe(playing);
  });
});
