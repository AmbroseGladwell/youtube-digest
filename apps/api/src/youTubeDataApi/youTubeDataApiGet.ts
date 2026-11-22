import type { z } from "zod";
import type { YouTubeFetch } from "@overview/transcripts";

const DATA_API = "https://www.googleapis.com/youtube/v3";

export class YouTubeDataApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface YouTubeDataApiGetOptions {
  apiKey: string;
  youTubeFetch: YouTubeFetch;
}

// The key goes in a header, never a URL that a log, proxy or error message could carry.
export const youTubeDataApiGet = ({ apiKey, youTubeFetch }: YouTubeDataApiGetOptions) => {
  return async <T>(path: string, params: Record<string, string>, schema: z.ZodType<T>): Promise<T | null> => {
    const response = await youTubeFetch({
      url: `${DATA_API}/${path}?${new URLSearchParams(params).toString()}`,
      method: "GET",
      headers: { accept: "application/json", "x-goog-api-key": apiKey },
    });
    if (response.status === 404) {
      return null;
    }
    if (response.status !== 200) {
      throw new YouTubeDataApiError(`The YouTube Data API answered ${response.status} to ${path}`, response.status);
    }
    return schema.parse(JSON.parse(response.body));
  };
};

export type YouTubeDataApiGet = ReturnType<typeof youTubeDataApiGet>;
