import { describe, expect, it } from "vitest";
import { READY_WITHIN_MS, TikTokEngine } from "./TikTokEngine.js";

const setUp = () => {
  const sent: object[] = [];
  const timers: { run: () => void; ms: number; cancelled: boolean }[] = [];
  let started = 0;
  let openedOutside = 0;
  const engine = new TikTokEngine({
    playbackId: "tiktok:7301234567890123456",
    durationMs: 58_000,
    onStart: () => (started += 1),
    openOutside: () => (openedOutside += 1),
    setTimer: (run, ms) => {
      const timer = { run, ms, cancelled: false };
      timers.push(timer);
      return () => (timer.cancelled = true);
    },
  });
  const frame = { post: (message: object) => sent.push(message) };
  return { engine, frame, sent, timers, started: () => started, openedOutside: () => openedOutside };
};

const message = (type: string, value?: unknown) => ({ "x-tiktok-player": true, type, value });

describe("TikTokEngine", () => {
  it("makes no player until it is pressed, and reports the note's position from the start so its times can seek", () => {
    const { engine } = setUp();
    expect(engine.getSnapshot().status).toBe("closed");
    expect(engine.playback.getPosition()).toEqual({ videoId: "tiktok:7301234567890123456", positionMs: 0, playing: false });
  });

  it("opens on play, and plays once TikTok says the player is ready", () => {
    const { engine, frame, sent, started } = setUp();
    engine.play();
    expect(engine.getSnapshot().status).toBe("loading");
    expect(started()).toBe(1);
    engine.attach(frame);
    engine.receive(message("onPlayerReady"));
    expect(sent).toEqual([{ "x-tiktok-player": true, type: "play" }]);
    engine.receive(message("onStateChange", 1));
    expect(engine.getSnapshot().status).toBe("playing");
    expect(engine.playback.getPosition()?.playing).toBe(true);
  });

  it("a time pressed before the player is open opens it, and seeks there in seconds once it's ready", () => {
    const { engine, frame, sent } = setUp();
    engine.playback.seekTo(24_000);
    expect(engine.getSnapshot()).toMatchObject({ status: "loading", positionMs: 24_000 });
    engine.attach(frame);
    engine.receive(JSON.stringify(message("onPlayerReady")));
    expect(sent).toEqual([
      { "x-tiktok-player": true, type: "seekTo", value: 24 },
      { "x-tiktok-player": true, type: "play" },
    ]);
  });

  it("a time pressed while playing seeks in place and keeps playing", () => {
    const { engine, frame, sent } = setUp();
    engine.play();
    engine.attach(frame);
    engine.receive(message("onPlayerReady"));
    sent.length = 0;
    engine.jump(41_000);
    expect(sent).toEqual([
      { "x-tiktok-player": true, type: "seekTo", value: 41 },
      { "x-tiktok-player": true, type: "play" },
    ]);
  });

  it("follows the time and length TikTok reports, which the note follows in turn", () => {
    const { engine } = setUp();
    engine.receive(message("onCurrentTime", { currentTime: 27.4, duration: 58.2 }));
    expect(engine.getSnapshot()).toMatchObject({ positionMs: 27_400, durationMs: 58_200 });
    expect(engine.playback.getPosition()?.positionMs).toBe(27_400);
  });

  it("pauses and toggles through the player, and reads ended as paused", () => {
    const { engine, frame, sent } = setUp();
    engine.play();
    engine.attach(frame);
    engine.receive(message("onPlayerReady"));
    engine.receive(message("onStateChange", 1));
    sent.length = 0;
    engine.toggle();
    expect(sent).toEqual([{ "x-tiktok-player": true, type: "pause" }]);
    engine.receive(message("onStateChange", 0));
    expect(engine.getSnapshot().status).toBe("paused");
  });

  it("counts a player that never says it's ready as one that won't load, and then sends times to TikTok", () => {
    const { engine, frame, timers, openedOutside } = setUp();
    engine.play();
    engine.attach(frame);
    expect(timers[0]?.ms).toBe(READY_WITHIN_MS);
    timers[0]!.run();
    expect(engine.getSnapshot().status).toBe("failed");
    engine.playback.seekTo(6_000);
    expect(openedOutside()).toBe(1);
  });

  it("fails on TikTok's own error, but only waits for a press when the browser blocked autoplay", () => {
    const blocked = setUp();
    blocked.engine.play();
    blocked.engine.attach(blocked.frame);
    blocked.engine.receive(message("onPlayerReady"));
    blocked.engine.receive(message("onPlayerError", { errorCode: 3002, errorType: "AUTOPLAY_ERROR" }));
    expect(blocked.engine.getSnapshot().status).toBe("paused");

    const broken = setUp();
    broken.engine.play();
    broken.engine.attach(broken.frame);
    broken.engine.receive(message("onPlayerError", { errorCode: 1001, errorType: "INVALID_VIDEO" }));
    expect(broken.engine.getSnapshot().status).toBe("failed");
  });

  it("stops waiting once ready, and ignores messages it doesn't know", () => {
    const { engine, frame, timers } = setUp();
    engine.play();
    engine.attach(frame);
    engine.receive(message("onPlayerReady"));
    expect(timers[0]?.cancelled).toBe(true);
    engine.receive("not json");
    engine.receive({ hello: "there" });
    expect(engine.getSnapshot().status).toBe("ready");
  });
});
