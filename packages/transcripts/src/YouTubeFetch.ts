export interface YouTubeFetchRequest {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
}

export interface YouTubeFetchResponse {
  status: number;
  body: string;
}

// A plain string body rather than a stream, because this crosses
// chrome.runtime.sendMessage and has to survive a structured clone. Supplying this is how
// a shell lends its CORS exemption to code that has none
// (docs/features/transcript-retrieval.md).
export type YouTubeFetch = (request: YouTubeFetchRequest) => Promise<YouTubeFetchResponse>;
