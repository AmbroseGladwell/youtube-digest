import { describe, expect, it } from "vitest";
import {
  adjustedTimer,
  isSameSource,
  oldestRingingFirst,
  pausedTimer,
  ranOut,
  resumedTimer,
  soonestFirst,
  startedTimer,
  timeLeftMs,
  type CookingTimer,
} from "./cookingTimers.js";

const MINUTE = 60_000;
const T0 = 1_000_000;

const timer = (id: number, minutes: number, at = T0): CookingTimer =>
  startedTimer(
    id,
    {
      name: "Boil",
      step: 1,
      source: { recipe: "curry", action: 2, time: 0, seconds: minutes * 60 },
      range: false,
      recipeTitle: "Weeknight curry",
      actionText: "Boil for 15 minutes.",
    },
    at,
  );

describe("cookingTimers", () => {
  it("reads the time left from the clock, so a throttled tab shows the right time when it comes back", () => {
    const boil = timer(1, 15);
    expect(timeLeftMs(boil, T0 + 7 * MINUTE)).toBe(8 * MINUTE);
  });

  it("rings at the moment it ran out, even when that was while the tab was hidden", () => {
    const [rung] = ranOut([timer(1, 10)], T0 + 25 * MINUTE);
    expect(rung!.rangAt).toBe(T0 + 10 * MINUTE);
    expect(timeLeftMs(rung!, T0 + 25 * MINUTE)).toBe(0);
  });

  it("keeps what was left while paused, not an end time", () => {
    const paused = pausedTimer(timer(1, 15), T0 + 3 * MINUTE);
    expect(timeLeftMs(paused, T0 + 60 * MINUTE)).toBe(12 * MINUTE);
    expect(ranOut([paused], T0 + 60 * MINUTE)[0]!.rangAt).toBeNull();
    const resumed = resumedTimer(paused, T0 + 60 * MINUTE);
    expect(timeLeftMs(resumed, T0 + 61 * MINUTE)).toBe(11 * MINUTE);
  });

  it("moves the end by a minute either way, and a minute less than is left rings", () => {
    const boil = timer(1, 15);
    expect(timeLeftMs(adjustedTimer(boil, 1, T0), T0)).toBe(16 * MINUTE);
    expect(timeLeftMs(adjustedTimer(boil, -1, T0), T0)).toBe(14 * MINUTE);
    const nearlyDone = adjustedTimer(boil, -1, T0 + 14.5 * MINUTE);
    expect(nearlyDone.rangAt).toBe(T0 + 14.5 * MINUTE);
  });

  it("turns a ringing timer back into a running one with a minute more", () => {
    const [rung] = ranOut([timer(1, 10)], T0 + 10 * MINUTE);
    const more = adjustedTimer(rung!, 1, T0 + 11 * MINUTE);
    expect(more.rangAt).toBeNull();
    expect(timeLeftMs(more, T0 + 11 * MINUTE)).toBe(MINUTE);
  });

  it("orders running timers soonest first, paused ones by what they have left, and ringing ones oldest first", () => {
    const now = T0 + 2 * MINUTE;
    const rice = timer(1, 15);
    const sauce = pausedTimer(timer(2, 10), T0 + MINUTE);
    const naan = timer(3, 8, T0 + MINUTE);
    expect(soonestFirst([rice, sauce, naan], now).map((t) => t.id)).toEqual([3, 2, 1]);
    const rung = ranOut([timer(4, 1), timer(5, 1, T0 - 30_000)], now);
    expect(oldestRingingFirst(rung).map((t) => t.id)).toEqual([5, 4]);
    expect(soonestFirst(rung, now)).toEqual([]);
  });

  it("tells the same time in two recipes apart, so one recipe's step 3 never reads as another's (OV-288)", () => {
    const source = { recipe: "curry", action: 3, time: 0, seconds: 600 };
    expect(isSameSource(source, { ...source })).toBe(true);
    expect(isSameSource(source, { ...source, recipe: "loaf" })).toBe(false);
  });
});
