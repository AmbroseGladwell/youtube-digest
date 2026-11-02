import { z } from "zod";
import {
  AccentColour,
  DEFAULT_ACCENT_COLOUR,
  DEFAULT_THEME_MODE,
  ThemeMode,
} from "@overview/domain";

export const Appearance = z.object({
  theme: ThemeMode.catch(DEFAULT_THEME_MODE),
  accentColour: AccentColour.catch(DEFAULT_ACCENT_COLOUR),
});
export type Appearance = z.infer<typeof Appearance>;

export const DEFAULT_APPEARANCE: Appearance = { theme: DEFAULT_THEME_MODE, accentColour: DEFAULT_ACCENT_COLOUR };

export const APPEARANCE_STORAGE_KEY = "overview.appearance.v1";

// This device's copy of the account's choice, read by public/appearance.js before first paint,
// when the settings store cannot have answered yet (docs/features/appearance.md, "No flash").
export function readAppearance(storage: Storage = globalThis.localStorage): Appearance {
  try {
    const raw = storage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = Appearance.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function writeAppearance(appearance: Appearance, storage: Storage = globalThis.localStorage): void {
  try {
    storage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    return;
  }
}
