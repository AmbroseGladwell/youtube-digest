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

// A string body, since it crosses chrome.runtime.sendMessage and must survive a structured clone.
export type YouTubeFetch = (request: YouTubeFetchRequest) => Promise<YouTubeFetchResponse>;
