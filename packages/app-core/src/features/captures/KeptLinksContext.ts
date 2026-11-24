import { createContext, useContext } from "react";
import type { KeptLinksController } from "./useKeptLinks.js";

const KeptLinksContext = createContext<KeptLinksController | null>(null);

export const KeptLinksProvider = KeptLinksContext.Provider;

// Null outside the shell, where no kept link is made or shown.
export const useKeptLinksController = (): KeptLinksController | null => useContext(KeptLinksContext);
