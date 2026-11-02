import { ACCENT_COLOURS } from "@overview/domain/accentPalette";
import { describe, expect, it } from "vitest";
import { accentButtonCss, mixColours, overviewButtonAccent } from "./overviewButtonAccent.js";

const YOUTUBE_PILL = { light: "#f2f2f2", dark: "#272727" };

const channels = (hex: string) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

function luminance(hex: string): number {
  const [red = 0, green = 0, blue = 0] = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(one: string, other: string): number {
  const [lighter, darker] = [luminance(one), luminance(other)].sort((a, b) => b - a) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

describe.each(ACCENT_COLOURS.slice(1))("the YouTube button in %s", (accentColour) => {
  it.each([
    ["light", false],
    ["dark", true],
  ] as const)("keeps its ready label readable, hovered or not, on YouTube %s", (_scheme, dark) => {
    const accent = overviewButtonAccent(accentColour, dark);

    for (const ground of [accent.readyTop, accent.readyBottom, accent.readyHoverTop, accent.readyHoverBottom]) {
      expect(contrast(accent.readyLabel, ground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps its mark visible on YouTube's pill", () => {
    expect(contrast(overviewButtonAccent(accentColour, false).mark, YOUTUBE_PILL.light)).toBeGreaterThanOrEqual(3);
    expect(contrast(overviewButtonAccent(accentColour, true).mark, YOUTUBE_PILL.dark)).toBeGreaterThanOrEqual(3);
  });
});

describe("mixColours", () => {
  it("moves the base towards the colour over it", () => {
    expect(mixColours("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixColours("#123456", "#ffffff", 0)).toBe("#123456");
  });
});

describe("the accent stylesheet", () => {
  it("leaves Orange to the hand-set rules", () => {
    expect(accentButtonCss("button")).not.toContain('data-accent="orange"');
  });

  it("covers both of YouTube's schemes for every other accent", () => {
    const css = accentButtonCss("button");

    for (const accentColour of ACCENT_COLOURS.slice(1)) {
      expect(css).toContain(`html:not([dark]) #button[data-accent="${accentColour}"]`);
      expect(css).toContain(`html[dark] #button[data-accent="${accentColour}"]`);
    }
  });
});
