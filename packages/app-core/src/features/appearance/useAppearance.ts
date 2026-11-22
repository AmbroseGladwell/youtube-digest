import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { readAppearance, type Appearance } from "./appearanceStorage.js";

// The device copy stands in only while the store opens: docs/features/appearance.md, "Signed out".
export const useAppearance = (): Appearance => {
  const settings = useSettingsQuery().data;
  if (settings === undefined) {
    return readAppearance();
  }
  return { theme: settings.theme, accentColour: settings.accentColour };
};
