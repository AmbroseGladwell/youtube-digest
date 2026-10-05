import {
  fetchInnerTubeTranscript,
  TranscriptFetchError,
  TranscriptFetchFailure,
  type FetchedTranscript,
  type YouTubeFetch,
} from "@overview/transcripts";
import type { ProxiedYouTubeFetch } from "./undiciYouTubeFetch.js";

const PROXY_SESSIONS = 2;

// What a datacenter address being turned away looks like: a bot check reads as a login
// wall, an empty caption track as blocked. A video with no captions or that doesn't exist
// will be the same through any address, so those never cost a proxied fetch.
const WORTH_THE_PROXY: ReadonlySet<TranscriptFetchFailure> = new Set([
  TranscriptFetchFailure.ACCESS_RESTRICTED,
  TranscriptFetchFailure.SOURCE_BLOCKED,
  TranscriptFetchFailure.RATE_LIMITED,
  TranscriptFetchFailure.SOURCE_UNAVAILABLE,
]);

export interface ServiceFetches {
  direct: YouTubeFetch;
  proxied: ((session: string) => ProxiedYouTubeFetch) | null;
  newSession: () => string;
}

export interface ProxyBudget {
  reserve: () => Promise<boolean>;
  release: () => Promise<void>;
  spend: (bytes: number) => Promise<void>;
}

export interface ServiceFetchResult {
  fetched: FetchedTranscript;
  via: "direct" | "proxy";
  proxySessions: number;
}

const isWorthTheProxy = (error: unknown): error is TranscriptFetchError =>
  error instanceof TranscriptFetchError && WORTH_THE_PROXY.has(error.failure);

export const budgetExhausted = () =>
  new TranscriptFetchError(
    "Our server has fetched all the transcripts it can for today. The extension can still fetch this one, or try again tomorrow.",
    { failure: TranscriptFetchFailure.BUDGET_EXHAUSTED, sourceId: "service" },
  );

// From our own address first, which costs nothing, and through the residential proxy only
// when YouTube turned that away (docs/architecture/server-side-transcripts.md).
export async function fetchThroughService(
  fetches: ServiceFetches,
  budget: ProxyBudget,
  videoId: string,
): Promise<ServiceFetchResult> {
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  let lastError: unknown;
  try {
    return { fetched: await fetchInnerTubeTranscript(fetches.direct, videoId, url), via: "direct", proxySessions: 0 };
  } catch (error) {
    if (fetches.proxied === null || !isWorthTheProxy(error)) throw error;
    lastError = error;
  }

  if (!(await budget.reserve())) throw budgetExhausted();

  let requests = 0;
  let bytes = 0;
  try {
    for (let session = 1; session <= PROXY_SESSIONS; session += 1) {
      const proxied = fetches.proxied(fetches.newSession());
      const counted: YouTubeFetch = async (request) => {
        requests += 1;
        const response = await proxied.youTubeFetch(request);
        bytes += Buffer.byteLength(request.body ?? "") + Buffer.byteLength(response.body);
        return response;
      };
      try {
        return { fetched: await fetchInnerTubeTranscript(counted, videoId, url), via: "proxy", proxySessions: session };
      } catch (error) {
        lastError = error;
        if (!isWorthTheProxy(error)) break;
      } finally {
        await proxied.close().catch(() => undefined);
      }
    }
    throw lastError;
  } finally {
    if (requests === 0) await budget.release();
    else await budget.spend(bytes);
  }
}
