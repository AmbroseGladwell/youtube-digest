import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { throttled } from "./throttled.js";

describe("throttled", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs the first call at once", () => {
    const run = vi.fn();
    throttled(run, 1000).call();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs the calls inside an interval once, at its end", () => {
    const run = vi.fn();
    const throttle = throttled(run, 1000);
    throttle.call();
    throttle.call();
    throttle.call();
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(run).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(5000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("runs at once again after a quiet interval", () => {
    const run = vi.fn();
    const throttle = throttled(run, 1000);
    throttle.call();
    vi.advanceTimersByTime(1000);
    throttle.call();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("runs what was waiting at once when flushed, and nothing when nothing waits", () => {
    const run = vi.fn();
    const throttle = throttled(run, 1000);
    throttle.call();
    throttle.flush();
    expect(run).toHaveBeenCalledTimes(1);
    throttle.call();
    throttle.flush();
    expect(run).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(5000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("drops what was waiting when cancelled", () => {
    const run = vi.fn();
    const throttle = throttled(run, 1000);
    throttle.call();
    throttle.call();
    throttle.cancel();
    vi.advanceTimersByTime(5000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
