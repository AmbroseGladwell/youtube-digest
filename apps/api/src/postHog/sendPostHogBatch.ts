export interface PostHogBatchOptions {
  apiKey: string;
  host: string;
  fetch?: typeof fetch | undefined;
  timeoutMs?: number;
}

export interface PostHogCapture {
  event: string;
  distinct_id: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

export class PostHogDeliveryError extends Error {}

// PostHog over its one batch call, with no SDK: its client would bring a queue and retries
// the request path doesn't want (docs/architecture/analytics.md, "Where events go").
export async function sendPostHogBatch(
  batch: PostHogCapture[],
  { apiKey, host, fetch: fetchImpl = globalThis.fetch, timeoutMs = 5_000 }: PostHogBatchOptions,
): Promise<void> {
  const response = await fetchImpl(`${host.replace(/\/+$/, "")}/batch/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, batch }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new PostHogDeliveryError(`PostHog answered ${response.status}`);
  }
}
