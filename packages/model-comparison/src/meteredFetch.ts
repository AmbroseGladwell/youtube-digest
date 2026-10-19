import type { Provider } from "@overview/domain";
import { tokenUsageOf, type TokenUsage } from "./TokenUsage.js";

export interface MeteredCall {
  status: number;
  latencyMs: number;
  usage: TokenUsage | null;
}

export interface MeteredFetch {
  http: typeof fetch;
  calls: MeteredCall[];
}

const parsedOrUndefined = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export function meteredFetch(
  provider: Provider,
  inner: typeof fetch,
  now: () => number = () => performance.now(),
): MeteredFetch {
  const calls: MeteredCall[] = [];
  const http: typeof fetch = async (input, init) => {
    const startedAt = now();
    const response = await inner(input, init);
    const body = await response.clone().text();
    calls.push({
      status: response.status,
      latencyMs: Math.round(now() - startedAt),
      usage: response.ok ? tokenUsageOf(provider, parsedOrUndefined(body)) : null,
    });
    return response;
  };
  return { http, calls };
}
