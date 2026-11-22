import { createContext, useContext } from "react";
import type { YouTubeFetch } from "@overview/transcripts";

// Injected because app-core can't read chrome.* and a web origin can't reach youtube.com past CORS.
const YouTubeFetchContext = createContext<YouTubeFetch | null>(null);

export const YouTubeFetchProvider = YouTubeFetchContext.Provider;

export const useYouTubeFetch = (): YouTubeFetch | null => {
  return useContext(YouTubeFetchContext);
};
