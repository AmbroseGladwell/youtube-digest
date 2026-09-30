import { describe, expect, it } from "vitest";
import { minutesLeft, minutesLeftPhrase } from "./minutesLeft.js";

const EXPIRES = "2026-09-30T10:30:00.000Z";
const at = (iso: string) => Date.parse(iso);

describe("minutesLeft", () => {
  it("rounds a part-minute up, so a request never reads as over before it is", () => {
    expect(minutesLeft(EXPIRES, at("2026-09-30T10:04:30.000Z"))).toBe(26);
    expect(minutesLeft(EXPIRES, at("2026-09-30T10:29:59.000Z"))).toBe(1);
  });

  it("stops at zero", () => {
    expect(minutesLeft(EXPIRES, at("2026-09-30T11:00:00.000Z"))).toBe(0);
  });
});

describe("minutesLeftPhrase", () => {
  it.each([
    [1, "1 more minute"],
    [26, "26 more minutes"],
  ])("%i reads %s", (minutes, phrase) => {
    expect(minutesLeftPhrase(minutes)).toBe(phrase);
  });
});
