import { ACCENT_COLOURS, ACCENT_PALETTES, DEFAULT_ACCENT_COLOUR, type AccentColour } from "@overview/domain/accentPalette";

export interface OverviewButtonAccent {
  mark: string;
  readyTop: string;
  readyBottom: string;
  readyHoverTop: string;
  readyHoverBottom: string;
  readyRing: string;
  readyLabel: string;
}

const channels = (hex: string): number[] => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

export function mixColours(base: string, over: string, amount: number): string {
  const [from, to] = [channels(base), channels(over)];
  const mixed = from.map((value, index) => Math.round(value + ((to[index] as number) - value) * amount));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

const ringOf = (hex: string, alpha: number) => `rgba(${channels(hex).join(",")},${alpha})`;

// Design 135k: today's recipe with the accent in the orange's place. Orange itself stays the
// hand-set values in overviewButtonStyles.ts.
export function overviewButtonAccent(accentColour: AccentColour, dark: boolean): OverviewButtonAccent {
  const palette = ACCENT_PALETTES[accentColour];
  if (dark) {
    const { mark } = palette.dark;
    return {
      mark,
      readyTop: mixColours("#1f1f1f", mark, 0.14),
      readyBottom: mixColours("#171717", mark, 0.1),
      readyHoverTop: mixColours("#1f1f1f", mark, 0.18),
      readyHoverBottom: mixColours("#171717", mark, 0.13),
      readyRing: ringOf(mark, 0.4),
      readyLabel: mark,
    };
  }
  const { brand, accentHover } = palette.light;
  return {
    mark: brand,
    readyTop: mixColours("#ffffff", brand, 0.07),
    readyBottom: mixColours("#ffffff", brand, 0.16),
    readyHoverTop: mixColours("#ffffff", brand, 0.11),
    readyHoverBottom: mixColours("#ffffff", brand, 0.22),
    readyRing: ringOf(brand, 0.36),
    readyLabel: accentHover,
  };
}

function schemeRules(id: string, accentColour: AccentColour, dark: boolean): string {
  const accent = overviewButtonAccent(accentColour, dark);
  const scheme = dark ? "html[dark]" : "html:not([dark])";
  const button = `${scheme} #${id}[data-accent="${accentColour}"]`;
  const highlight = dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.45)";
  return `
${button} { --ovb-mark: ${accent.mark}; }
${button}[data-state="ready"] {
  background: linear-gradient(180deg, ${accent.readyTop} 0%, ${accent.readyBottom} 100%);
  box-shadow: inset 0 0.5px 0 ${highlight}, inset 0 0 0 1px ${accent.readyRing};
  color: ${accent.readyLabel};
}
${button}[data-state="ready"]:hover {
  background: linear-gradient(180deg, ${accent.readyHoverTop} 0%, ${accent.readyHoverBottom} 100%);
}`;
}

export const accentButtonCss = (id: string): string =>
  ACCENT_COLOURS.filter((accentColour) => accentColour !== DEFAULT_ACCENT_COLOUR)
    .flatMap((accentColour) => [schemeRules(id, accentColour, false), schemeRules(id, accentColour, true)])
    .join("");
