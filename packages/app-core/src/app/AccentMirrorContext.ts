import { createContext, useContext } from "react";
import type { AccentColour } from "@overview/domain";

// Hands the accent to the parts of the shell the app doesn't run in: the extension's service
// worker, which draws the toolbar icon, and the button injected on YouTube. Neither can read
// the page's storage (docs/features/appearance.md, "The logo"). The web app has none.
export type AccentMirror = (accentColour: AccentColour) => void;

const AccentMirrorContext = createContext<AccentMirror | null>(null);

export const AccentMirrorProvider = AccentMirrorContext.Provider;

export function useAccentMirror(): AccentMirror | null {
  return useContext(AccentMirrorContext);
}
