import type { LineNarrated, Narration, NarrationRequest, Narrator, SpeechHost } from "../audio/Narrator.js";
import type { Slots } from "./Slots.js";

export interface FallbackReason {
  requestId: string;
  reason: "closed" | "slow" | "failed";
  error?: string;
}

export interface FallbackNarratorOptions {
  primary: Narrator;
  fallback: Narrator;
  firstLineMs: number;
  primaryOpen: () => boolean;
  onFallback: (reason: FallbackReason) => void;
  // How many may be on the fallback at once, since the Fly pool takes one request per machine (OV-431).
  fallbackSlots?: Slots | null;
  schedule?: (action: () => void, ms: number) => () => void;
}

const timer = (action: () => void, ms: number) => {
  const handle = setTimeout(action, ms);
  return () => clearTimeout(handle);
};

class NoFirstLine extends Error {}

// When Modal gives way to Fly: docs/features/tts-pre-rendered-speech.md, "On Modal (OV-423)".
export const createFallbackNarrator = ({
  primary,
  fallback,
  firstLineMs,
  primaryOpen,
  onFallback,
  fallbackSlots = null,
  schedule = timer,
}: FallbackNarratorOptions): Narrator => {
  const onFallbackHost = async (
    request: NarrationRequest,
    requestId: string,
    onLine: (line: LineNarrated) => Promise<void>,
    signal: AbortSignal | undefined,
  ): Promise<Narration> => {
    const release = fallbackSlots === null ? () => {} : await fallbackSlots.take();
    try {
      return { ...(await fallback.narrate(request, requestId, onLine, signal)), fellBack: true };
    } finally {
      release();
    }
  };

  return {
    async warm(requestId): Promise<SpeechHost> {
      return primaryOpen() ? primary.warm(requestId) : fallback.warm(requestId);
    },
    async narrate(request, requestId, onLine, signal) {
      if (!primaryOpen()) {
        onFallback({ requestId, reason: "closed" });
        return onFallbackHost(request, requestId, onLine, signal);
      }
      const giveUp = new AbortController();
      let spoke = false;
      const cancel = schedule(() => {
        if (!spoke) {
          giveUp.abort(new NoFirstLine());
        }
      }, firstLineMs);
      const abortOnStop = () => giveUp.abort(signal?.reason);
      signal?.addEventListener("abort", abortOnStop, { once: true });
      try {
        return await primary.narrate(
          request,
          requestId,
          async (line) => {
            spoke = true;
            await onLine(line);
          },
          giveUp.signal,
        );
      } catch (error) {
        if (spoke || signal?.aborted === true) {
          throw error;
        }
        const slow = giveUp.signal.reason instanceof NoFirstLine;
        onFallback({ requestId, reason: slow ? "slow" : "failed", ...(slow ? {} : { error: String(error) }) });
        return onFallbackHost(request, requestId, onLine, signal);
      } finally {
        cancel();
        signal?.removeEventListener("abort", abortOnStop);
      }
    },
  };
};
