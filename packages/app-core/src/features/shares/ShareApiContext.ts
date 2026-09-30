import { createContext, useContext } from "react";
import type { ShareApi } from "@overview/sync";

// The share API this shell was handed, null when there is no account to share under.
// Everything sharing offers hides itself when this is null, rather than presenting a
// control that cannot work (docs/features/sharing.md).
const ShareApiContext = createContext<ShareApi | null>(null);

export const ShareApiProvider = ShareApiContext.Provider;

export function useShareApi(): ShareApi | null {
  return useContext(ShareApiContext);
}
