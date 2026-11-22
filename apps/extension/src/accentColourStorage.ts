import { ACCENT_COLOURS, DEFAULT_ACCENT_COLOUR, type AccentColour } from "@overview/domain/accentPalette";

const ACCENT_COLOUR = "overview/accent-colour";

const isAccentColour = (value: unknown): value is AccentColour => ACCENT_COLOURS.some((accentColour) => accentColour === value);

// The worker and content script can't read the pages' localStorage: docs/features/appearance.md, "The logo".
export const writeAccentColour = (accentColour: AccentColour): Promise<void> =>
  chrome.storage.local.set({ [ACCENT_COLOUR]: accentColour }).catch(() => undefined);

export const readAccentColour = async (): Promise<AccentColour> => {
  try {
    const stored = await chrome.storage.local.get(ACCENT_COLOUR);
    const accentColour = stored[ACCENT_COLOUR];
    return isAccentColour(accentColour) ? accentColour : DEFAULT_ACCENT_COLOUR;
  } catch {
    return DEFAULT_ACCENT_COLOUR;
  }
};

export const onAccentColourChanged = (listener: () => void): void => {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && ACCENT_COLOUR in changes) {
      listener();
    }
  });
};
