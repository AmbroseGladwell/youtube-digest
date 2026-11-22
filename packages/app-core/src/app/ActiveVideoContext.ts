import { createContext, useContext, useSyncExternalStore } from "react";

export interface ActiveVideoSource {
  subscribe: (onChange: () => void) => () => void;
  getVideoUrl: () => string | null;
}

// Injected because app-core can't read chrome.* to find out whether its shell can see tabs.
const ActiveVideoContext = createContext<ActiveVideoSource | null>(null);

export const ActiveVideoProvider = ActiveVideoContext.Provider;

const subscribeToNothing = () => () => {};
const noActiveVideo = () => null;

export const useActiveVideoUrl = (): string | null => {
  const source = useContext(ActiveVideoContext);
  return useSyncExternalStore(source?.subscribe ?? subscribeToNothing, source?.getVideoUrl ?? noActiveVideo);
};
