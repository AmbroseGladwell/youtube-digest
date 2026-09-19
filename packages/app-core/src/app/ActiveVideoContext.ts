import { createContext, useContext, useSyncExternalStore } from "react";

export interface ActiveVideoSource {
  subscribe: (onChange: () => void) => () => void;
  getVideoUrl: () => string | null;
}

// Injected by the shell, because app-core can't read chrome.* to find out whether it is
// in one that can see tabs (docs/features/watching-detection.md).
const ActiveVideoContext = createContext<ActiveVideoSource | null>(null);

export const ActiveVideoProvider = ActiveVideoContext.Provider;

const subscribeToNothing = () => () => {};
const noActiveVideo = () => null;

export function useActiveVideoUrl(): string | null {
  const source = useContext(ActiveVideoContext);
  return useSyncExternalStore(source?.subscribe ?? subscribeToNothing, source?.getVideoUrl ?? noActiveVideo);
}
