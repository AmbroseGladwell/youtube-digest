// Free of zod and everything else, so the script on every YouTube page can take it alone
// (docs/features/appearance.md, "The logo").

// In wheel order, the order Settings shows them (design 135a).
export const ACCENT_COLOURS = ["orange", "gold", "lime", "emerald", "teal", "sky", "violet", "raspberry"] as const;
export type AccentColour = (typeof ACCENT_COLOURS)[number];
export const DEFAULT_ACCENT_COLOUR: AccentColour = "orange";

export const ACCENT_COLOUR_NAMES: Record<AccentColour, string> = {
  orange: "Orange",
  gold: "Gold",
  lime: "Lime",
  emerald: "Emerald",
  teal: "Teal",
  sky: "Sky",
  violet: "Violet",
  raspberry: "Raspberry",
};

export interface AccentPalette {
  light: {
    brand: string;
    action: string;
    actionHover: string;
    actionPress: string;
    accent: string;
    accentHover: string;
  };
  dark: {
    brand: string;
    mark: string;
    accentHover: string;
  };
  onAction: string;
}

// tokens.scss holds the same values for the app; these reach what its stylesheet cannot.
// accentContrast.test.ts holds the two together and measures every pairing.
export const ACCENT_PALETTES: Record<AccentColour, AccentPalette> = {
  orange: {
    light: {
      brand: "#e2511e",
      action: "#cf4718",
      actionHover: "#b03c12",
      actionPress: "#9a3410",
      accent: "#b03c12",
      accentHover: "#8f3210",
    },
    dark: { brand: "#e2511e", mark: "#f0794a", accentHover: "#f5a07f" },
    onAction: "#ffffff",
  },
  gold: {
    light: {
      brand: "#9d7f02",
      action: "#f7c900",
      actionHover: "#e3b90c",
      actionPress: "#d0aa09",
      accent: "#776000",
      accentHover: "#614d00",
    },
    dark: { brand: "#f7c900", mark: "#f7c900", accentHover: "#ffdf7c" },
    onAction: "#151618",
  },
  lime: {
    light: {
      brand: "#558c03",
      action: "#4d8100",
      actionHover: "#416e00",
      actionPress: "#396100",
      accent: "#416e00",
      accentHover: "#305400",
    },
    dark: { brand: "#6cb201", mark: "#6cb201", accentHover: "#84c939" },
    onAction: "#ffffff",
  },
  emerald: {
    light: {
      brand: "#058f62",
      action: "#00845a",
      actionHover: "#00704c",
      actionPress: "#026343",
      accent: "#00704c",
      accentHover: "#005639",
    },
    dark: { brand: "#0bb67d", mark: "#0bb67d", accentHover: "#5ecb9a" },
    onAction: "#ffffff",
  },
  teal: {
    light: {
      brand: "#008c89",
      action: "#00817f",
      actionHover: "#006e6c",
      actionPress: "#04615f",
      accent: "#006e6c",
      accentHover: "#005453",
    },
    dark: { brand: "#09b2ae", mark: "#09b2ae", accentHover: "#56c8c3" },
    onAction: "#ffffff",
  },
  sky: {
    light: {
      brand: "#0285c0",
      action: "#057bb1",
      actionHover: "#006898",
      actionPress: "#025c86",
      accent: "#006898",
      accentHover: "#025074",
    },
    dark: { brand: "#34a9e8", mark: "#34a9e8", accentHover: "#72bfef" },
    onAction: "#ffffff",
  },
  violet: {
    light: {
      brand: "#8a6ad5",
      action: "#8160ca",
      actionHover: "#6c53a9",
      actionPress: "#61479c",
      accent: "#6c53a9",
      accentHover: "#563a8f",
    },
    dark: { brand: "#aa90ef", mark: "#aa90ef", accentHover: "#beacf4" },
    onAction: "#ffffff",
  },
  raspberry: {
    light: {
      brand: "#d44a84",
      action: "#c93f7b",
      actionHover: "#a93868",
      actionPress: "#9b2a5c",
      accent: "#a93868",
      accentHover: "#8c1b50",
    },
    dark: { brand: "#f277a5", mark: "#f277a5", accentHover: "#f99bbb" },
    onAction: "#ffffff",
  },
};
