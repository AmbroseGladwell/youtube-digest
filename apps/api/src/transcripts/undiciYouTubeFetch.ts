import type { YouTubeFetch } from "@overview/transcripts";
import { fetch, ProxyAgent, type Dispatcher } from "undici";

export const YOUTUBE_FETCH_TIMEOUT_MS = 10_000;

export interface ProxiedYouTubeFetch {
  youTubeFetch: YouTubeFetch;
  close: () => Promise<void>;
}

export const undiciYouTubeFetch =
  (dispatcher?: Dispatcher): YouTubeFetch =>
  async (request) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      ...(request.body === undefined ? {} : { body: request.body }),
      ...(dispatcher === undefined ? {} : { dispatcher }),
      signal: AbortSignal.timeout(YOUTUBE_FETCH_TIMEOUT_MS),
    });
    return { status: response.status, body: await response.text() };
  };

// Sticky sessions: docs/architecture/server-side-transcripts.md, "The provider: Decodo, behind one URL".
export const proxiedYouTubeFetch =
  (proxyUrl: string) =>
  (session: string): ProxiedYouTubeFetch => {
    const agent = new ProxyAgent(proxyUrl.replaceAll("{session}", session));
    return { youTubeFetch: undiciYouTubeFetch(agent), close: () => agent.close() };
  };
