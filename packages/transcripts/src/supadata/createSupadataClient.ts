import {
  SupadataError,
  type GeneralTranscriptParams,
  type JobResult,
  type Metadata,
  type Transcript,
  type TranscriptOrJobId,
} from "@supadata/js";
import type { SupadataClient } from "./SupadataClient.js";

export const SUPADATA_BASE_URL = "https://api.supadata.ai/v1";

export interface SupadataClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

// The only header sent. The SDK's own transport adds a User-Agent, which WebKit puts in
// the CORS preflight and Supadata's allow-list refuses (docs/features/transcript-retrieval.md).
export const supadataRequestHeaders = (apiKey: string): Record<string, string> => ({
  "x-api-key": apiKey,
});

type QueryParams = Record<string, string | number | boolean | undefined>;

export function createSupadataClient(options: SupadataClientOptions): SupadataClient {
  const baseUrl = options.baseUrl ?? SUPADATA_BASE_URL;
  const fetchImpl = options.fetch ?? globalThis.fetch;

  const get = async <T>(path: string, params: QueryParams = {}): Promise<T> => {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: supadataRequestHeaders(options.apiKey),
    });
    return readSupadataResponse<T>(response);
  };

  return {
    metadata: (params) => get<Metadata>("/metadata", params),
    transcript: Object.assign(
      (params: GeneralTranscriptParams) => get<TranscriptOrJobId>("/transcript", { ...params }),
      {
        getJobStatus: (jobId: string) =>
          get<JobResult<Transcript>>(`/transcript/${encodeURIComponent(jobId)}`),
      },
    ),
  };
}

async function readSupadataResponse<T>(response: Response): Promise<T> {
  const isJson = response.headers.get("content-type")?.includes("application/json") ?? false;
  if (!response.ok) {
    if (isJson) throw new SupadataError((await response.json()) as ConstructorParameters<typeof SupadataError>[0]);
    throw new SupadataError({
      error: "internal-error",
      message: `Supadata answered ${response.status} with a non-JSON body`,
      details: await response.text(),
    });
  }
  if (!isJson) {
    throw new SupadataError({
      error: "internal-error",
      message: "Supadata answered with a non-JSON body",
      details: await response.text(),
    });
  }
  return (await response.json()) as T;
}
