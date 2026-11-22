import { createContext, useContext } from "react";
import type { NarrationApi } from "@overview/sync";

// Null when signed out: docs/features/narration-voice.md, "Signed out".
const NarrationApiContext = createContext<NarrationApi | null>(null);

export const NarrationApiProvider = NarrationApiContext.Provider;

export const useNarrationApi = (): NarrationApi | null => {
  return useContext(NarrationApiContext);
};
