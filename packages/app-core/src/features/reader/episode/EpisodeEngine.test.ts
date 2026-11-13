import { describe, expect, it, vi } from "vitest";
import { EpisodeEngine, type EpisodeMedia } from "./EpisodeEngine.js";

class FakeMedia {
  src = "";
  currentTime = 0;
  duration = Number.NaN;
  paused = true;
  preload = "";
  readonly #handlers = new Map<string, (() => void)[]>();
  addEventListener(type: string, handler: () => void) {
    this.#handlers.set(type, [...(this.#handlers.get(type) ?? []), handler]);
  }
  emit(type: string) {
    for (const handler of this.#handlers.get(type) ?? []) handler();
  }
  play() {
    this.paused = false;
    this.emit("playing");
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.emit("pause");
  }
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
  load() {}
  playTo(seconds: number) {
    this.currentTime = seconds;
    this.emit("timeupdate");
  }
}

const engineWith = (onStart = () => {}) => {
  const media = new FakeMedia();
  const createMedia = vi.fn(() => media as unknown as EpisodeMedia);
  const engine = new EpisodeEngine({ audioUrl: "https://media.example/ep.mp3", playbackId: "podcast:abc", createMedia, onStart });
  return { engine, media, createMedia };
};

describe("EpisodeEngine", () => {
  it("makes no audio element until the episode is played, so a note only read costs the host nothing", () => {
    const { engine, createMedia } = engineWith();
    expect(engine.getSnapshot().status).toBe("idle");
    expect(createMedia).not.toHaveBeenCalled();
    engine.play();
    expect(createMedia).toHaveBeenCalledOnce();
  });

  it("reports the element's own clock as the note's playback position", () => {
    const { engine, media } = engineWith();
    engine.play();
    media.playTo(61.5);
    expect(engine.playback.getPosition()).toEqual({ videoId: "podcast:abc", positionMs: 61_500, playing: true });
  });

  it("plays a time in the note from there and counts it as a jump, which the skips and scrubber are not", () => {
    const { engine, media } = engineWith();
    engine.playback.seekTo(860_000);
    expect(media.currentTime).toBe(860);
    expect(media.paused).toBe(false);
    expect(engine.getSnapshot().jumps).toBe(1);
    engine.skip(30);
    engine.seek(100_000);
    expect(engine.getSnapshot().jumps).toBe(1);
  });

  it("stops at the end of a range", () => {
    const { engine, media } = engineWith();
    engine.playback.seekTo(6_190_000, 6_680_000);
    media.playTo(6_400);
    expect(media.paused).toBe(false);
    media.playTo(6_680.2);
    expect(media.paused).toBe(true);
    expect(engine.getSnapshot().status).toBe("paused");
  });

  it("lets the narration step aside whenever the episode starts", () => {
    const onStart = vi.fn();
    const { engine } = engineWith(onStart);
    engine.play();
    engine.playback.seekTo(1000);
    expect(onStart).toHaveBeenCalledTimes(2);
  });

  it("never skips back before the start", () => {
    const { engine, media } = engineWith();
    engine.play();
    media.playTo(5);
    engine.skip(-15);
    expect(media.currentTime).toBe(0);
  });

  it("says when the audio can't be played, so the strip can say so", () => {
    const { engine, media } = engineWith();
    engine.play();
    media.emit("error");
    expect(engine.getSnapshot().status).toBe("failed");
  });

  it("lets go of the audio when the reader leaves the overview", () => {
    const { engine, media } = engineWith();
    engine.play();
    engine.dispose();
    expect(media.paused).toBe(true);
    expect(media.src).toBe("");
  });
});
