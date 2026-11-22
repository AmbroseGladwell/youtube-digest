import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { readAppearance, type Appearance } from "./appearanceStorage.js";

// The open library's choice: the account's signed in, and signed out the no-account library's
// own, never the last account's (OV-361). Only while the store is still opening does the device
// copy stand in, so the page doesn't jump (docs/features/appearance.md, "Signed out").
export function useAppearance(): Appearance {
  const settings = useSettingsQuery().data;
  if (settings === undefined) return readAppearance();
  return { theme: settings.theme, accentColour: settings.accentColour };
}
