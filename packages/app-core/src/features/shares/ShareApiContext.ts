import { createContext, useContext } from "react";
import type { ShareApi } from "@overview/sync";

// Null without an account, and everything sharing offers then hides itself.
const ShareApiContext = createContext<ShareApi | null>(null);

export const ShareApiProvider = ShareApiContext.Provider;

export const useShareApi = (): ShareApi | null => {
  return useContext(ShareApiContext);
};
