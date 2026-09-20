import { createContext, useContext } from "react";
import type { YouTubeFetch } from "@overview/transcripts";

// Injected by the shell, because app-core can't read chrome.* and a web origin has no
// exemption from CORS for youtube.com. A shell that supplies none has no free caption
// path, and the rung built on it is simply absent (docs/features/transcript-retrieval.md).
const YouTubeFetchContext = createContext<YouTubeFetch | null>(null);

export const YouTubeFetchProvider = YouTubeFetchContext.Provider;

export function useYouTubeFetch(): YouTubeFetch | null {
  return useContext(YouTubeFetchContext);
}
