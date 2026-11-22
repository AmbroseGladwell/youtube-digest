import { z } from "zod";
import { HostJobState, type Transcriber } from "./Transcriber.js";

const CALL_TIMEOUT_MS = 20_000;

const Submitted = z.object({ callId: z.string().min(1) });

export const createHttpTranscriber = (baseUrl: string, token: string, fetchImpl: typeof fetch = fetch): Transcriber => {
  const base = baseUrl.replace(/\/+$/, "");
  const call = async (method: string, path: string, body?: object): Promise<unknown> => {
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`The transcriber answered ${response.status} to ${method} ${path.split("/")[1]}`);
    }
    return response.json();
  };
  return {
    submit: async (audioUrl, maxSeconds) => Submitted.parse(await call("POST", "/jobs", { audioUrl, maxSeconds })).callId,
    status: async (callId) => HostJobState.parse(await call("GET", `/jobs/${encodeURIComponent(callId)}`)),
    cancel: async (callId) => {
      await call("DELETE", `/jobs/${encodeURIComponent(callId)}`);
    },
  };
};
