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

// How big the image at the top of a note is drawn, on every note that has one
// (docs/features/stone-theme.md, "The head's image").
export const HEAD_IMAGE_SIZES = ["small", "full"] as const;
export const HeadImageSize = z.enum(HEAD_IMAGE_SIZES);
export type HeadImageSize = z.infer<typeof HeadImageSize>;
export const DEFAULT_HEAD_IMAGE_SIZE: HeadImageSize = "small";

export const HEAD_IMAGE_SIZE_NAMES: Record<HeadImageSize, string> = {
  small: "Small",
  full: "Full width",
};

export const AccentColour = z.enum(ACCENT_COLOURS);
export type AccentColour = z.infer<typeof AccentColour>;
