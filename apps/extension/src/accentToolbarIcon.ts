import { DEFAULT_ACCENT_COLOUR, type AccentColour } from "@overview/domain/accentPalette";
import { readAccentColour } from "./accentColourStorage.js";

export function accentToolbarIconPaths(accentColour: AccentColour): Record<"16" | "32", string> {
  const folder = accentColour === DEFAULT_ACCENT_COLOUR ? "icons" : `icons/accents/${accentColour}`;
  return { "16": `${folder}/icon16.png`, "32": `${folder}/icon32.png` };
}

export async function showAccentOnToolbar(): Promise<void> {
  await chrome.action.setIcon({ path: accentToolbarIconPaths(await readAccentColour()) }).catch(() => undefined);
}
