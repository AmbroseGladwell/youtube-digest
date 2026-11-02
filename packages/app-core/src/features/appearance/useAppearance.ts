import { DEFAULT_ACCENT_COLOUR, DEFAULT_THEME_MODE } from "@overview/domain";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { readAppearance, type Appearance } from "./appearanceStorage.js";

// The settings store's answer, except while it has none to give: as it opens, and signed out
// with nothing chosen, when the device keeps the look it last had so the sign-in page doesn't
// jump (docs/features/appearance.md, "Signed out").
export function useAppearance(): Appearance {
  const settings = useSettingsQuery().data;
  const accountId = useLibraryAccountId();
  if (settings === undefined) return readAppearance();

  const nothingChosen = settings.theme === DEFAULT_THEME_MODE && settings.accentColour === DEFAULT_ACCENT_COLOUR;
  if (accountId === null && nothingChosen) return readAppearance();
  return { theme: settings.theme, accentColour: settings.accentColour };
}
