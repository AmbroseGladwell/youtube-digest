import { join } from "node:path";
import { ACCENT_COLOURS, ACCENT_PALETTES, DEFAULT_ACCENT_COLOUR, type AccentColour } from "@overview/domain";
import { compile } from "sass";
import { describe, expect, it } from "vitest";

const TEXT = 4.5;
const NON_TEXT = 3;

const LIGHT_GROUNDS = { ground: "#f6f4f0", surface: "#eae7e1", card: "#ffffff", stoneTint: "#e4e0d9" };
const DARK_GROUNDS = {
  ground: "#151618",
  surface: "#222428",
  card: "#1e1f22",
  cardHover: "#292b2f",
  dialog: "#26282c",
  stoneTint: "#2c2b29",
};

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

const lowestOn = (colour: string, grounds: Record<string, string>) =>
  Math.min(...Object.values(grounds).map((ground) => contrast(colour, ground)));

const mix = (over: string, base: string, amount: number) => {
  const [from, to] = [channels(over), channels(base)];
  return `#${from
    .map((value, index) => Math.round(value * amount + (to[index] as number) * (1 - amount)))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
};

const css = compile(join(process.cwd(), "src/theme/tokens.scss")).css;

function declaredIn(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} is in tokens.scss`).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries(
    body
      .split(";")
      .map((declaration) => declaration.trim().split(/:\s*/))
      .filter((pair): pair is [string, string] => pair.length === 2),
  );
}

const hex = (value: string | undefined) => value?.toLowerCase();

const customColours = ACCENT_COLOURS.filter((accentColour) => accentColour !== DEFAULT_ACCENT_COLOUR);

describe.each(ACCENT_COLOURS)("the %s accent", (accentColour: AccentColour) => {
  const { light, dark, onAction } = ACCENT_PALETTES[accentColour];
  const darkAccent = dark.mark;

  it("keeps its text readable on every ground it sits on", () => {
    expect(lowestOn(light.accent, LIGHT_GROUNDS)).toBeGreaterThanOrEqual(TEXT);
    expect(lowestOn(light.accentHover, LIGHT_GROUNDS)).toBeGreaterThanOrEqual(TEXT);
    expect(lowestOn(darkAccent, DARK_GROUNDS)).toBeGreaterThanOrEqual(TEXT);
    expect(lowestOn(dark.accentHover, DARK_GROUNDS)).toBeGreaterThanOrEqual(TEXT);
  });

  it("keeps its label readable on every state of the action, in both themes", () => {
    for (const fill of [light.action, light.actionHover, light.actionPress]) {
      expect(contrast(onAction, fill)).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it("keeps its marks, progress and focus ring visible", () => {
    const { stoneTint: _stoneTint, ...lightGrounds } = LIGHT_GROUNDS;
    expect(lowestOn(light.brand, lightGrounds)).toBeGreaterThanOrEqual(NON_TEXT);
    expect(lowestOn(dark.brand, DARK_GROUNDS)).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it("keeps the ink readable on a search hit", () => {
    expect(contrast("#151618", mix(light.brand, "#f6f4f0", 0.18))).toBeGreaterThanOrEqual(TEXT);
    expect(contrast("#f2efe9", mix(light.brand, "#151618", 0.3))).toBeGreaterThanOrEqual(TEXT);
  });

  it("keeps the swatch and its check visible on the Appearance card", () => {
    expect(contrast(light.brand, LIGHT_GROUNDS.card)).toBeGreaterThanOrEqual(NON_TEXT);
    expect(contrast(dark.mark, DARK_GROUNDS.card)).toBeGreaterThanOrEqual(NON_TEXT);
    expect(contrast("#ffffff", light.brand)).toBeGreaterThanOrEqual(NON_TEXT);
    expect(contrast(DARK_GROUNDS.ground, dark.mark)).toBeGreaterThanOrEqual(NON_TEXT);
  });
});

describe("the tokens", () => {
  it("are Orange at the root and in the dark block", () => {
    const { light, dark, onAction } = ACCENT_PALETTES.orange;
    const root = declaredIn(":root");
    const darkRoot = declaredIn(':root[data-theme=dark]');

    expect(hex(root["--brand"])).toBe(light.brand);
    expect(hex(root["--action"])).toBe(light.action);
    expect(hex(root["--action-hover"])).toBe(light.actionHover);
    expect(hex(root["--action-press"])).toBe(light.actionPress);
    expect(hex(root["--accent"])).toBe(light.accent);
    expect(hex(root["--accent-hover"])).toBe(light.accentHover);
    expect(hex(root["--on-action"])).toMatch(new RegExp(`^(${onAction}|#fff)$`));
    expect(hex(darkRoot["--mark"])).toBe(dark.mark);
    expect(hex(darkRoot["--accent"])).toBe(dark.mark);
    expect(hex(darkRoot["--accent-hover"])).toBe(dark.accentHover);
  });

  it.each(customColours)("match the palette for %s, light and dark", (accentColour) => {
    const { light, dark, onAction } = ACCENT_PALETTES[accentColour];
    const lightTokens = declaredIn(`:root[data-accent=${accentColour}]`);
    const darkTokens = declaredIn(`:root[data-accent=${accentColour}][data-theme=dark]`);

    expect(hex(lightTokens["--brand"])).toBe(light.brand);
    expect(hex(lightTokens["--mark"])).toBe(light.brand);
    expect(hex(lightTokens["--action"])).toBe(light.action);
    expect(hex(lightTokens["--action-hover"])).toBe(light.actionHover);
    expect(hex(lightTokens["--action-press"])).toBe(light.actionPress);
    expect(hex(lightTokens["--accent"])).toBe(light.accent);
    expect(hex(lightTokens["--accent-hover"])).toBe(light.accentHover);
    expect(hex(lightTokens["--on-action"])?.startsWith(onAction.slice(0, 4))).toBe(true);
    expect(hex(darkTokens["--brand"])).toBe(dark.brand);
    expect(hex(darkTokens["--mark"])).toBe(dark.mark);
    expect(hex(darkTokens["--accent"])).toBe(dark.mark);
    expect(hex(darkTokens["--accent-hover"])).toBe(dark.accentHover);
  });

  it("keep the alert apart from every accent's blocks", () => {
    for (const accentColour of customColours) {
      expect(declaredIn(`:root[data-accent=${accentColour}]`)["--alert"]).toBeUndefined();
      expect(declaredIn(`:root[data-accent=${accentColour}][data-theme=dark]`)["--alert"]).toBeUndefined();
    }
  });
});
