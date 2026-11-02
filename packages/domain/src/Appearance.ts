import { z } from "zod";
import { ACCENT_COLOURS } from "./accentPalette.js";

export { ACCENT_COLOUR_NAMES, ACCENT_COLOURS, ACCENT_PALETTES, DEFAULT_ACCENT_COLOUR } from "./accentPalette.js";
export type { AccentPalette } from "./accentPalette.js";

export const THEME_MODES = ["system", "light", "dark"] as const;
export const ThemeMode = z.enum(THEME_MODES);
export type ThemeMode = z.infer<typeof ThemeMode>;
export const DEFAULT_THEME_MODE: ThemeMode = "system";

export const THEME_MODE_NAMES: Record<ThemeMode, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export const AccentColour = z.enum(ACCENT_COLOURS);
export type AccentColour = z.infer<typeof AccentColour>;
