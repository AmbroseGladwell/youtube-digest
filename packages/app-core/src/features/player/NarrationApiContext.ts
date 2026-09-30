import { createContext, useContext } from "react";
import type { NarrationApi } from "@overview/sync";

// The narration API the player was handed, null when there is no account to narrate for:
// what the voice picker samples through, and why it is absent when narration is
// (docs/features/narration-voice.md, "Signed out").
const NarrationApiContext = createContext<NarrationApi | null>(null);

export const NarrationApiProvider = NarrationApiContext.Provider;

export function useNarrationApi(): NarrationApi | null {
  return useContext(NarrationApiContext);
}
