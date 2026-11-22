import { createContext, useContext } from "react";
import type { AccentColour } from "@overview/domain";

// Why the shell needs the accent mirrored: docs/features/appearance.md, "The logo".
export type AccentMirror = (accentColour: AccentColour) => void;

const AccentMirrorContext = createContext<AccentMirror | null>(null);

export const AccentMirrorProvider = AccentMirrorContext.Provider;

export const useAccentMirror = (): AccentMirror | null => {
  return useContext(AccentMirrorContext);
};
