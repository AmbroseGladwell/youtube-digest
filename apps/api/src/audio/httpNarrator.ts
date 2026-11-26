import { z } from "zod";
import { REQUEST_ID_HEADER } from "@overview/domain";
import type { NarrationSegment, Narrator } from "./Narrator.js";

const RENDER_TIMEOUT_MS = 10 * 60 * 1000;
const WARM_TIMEOUT_MS = 30 * 1000;

const Segment = z.object({
  index: z.number().int().nonnegative(),
  durationSeconds: z.number().positive(),
  audioBase64: z.string().min(1),
});

const StreamEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("line"),
    index: z.number().int().nonnegative(),
    startSeconds: z.number().nonnegative(),
    segments: z.array(Segment),
  }),
  z.object({
    type: z.literal("done"),
    renderVersion: z.number().int(),
    lineStartsSeconds: z.array(z.number().nonnegative()),
    durationSeconds: z.number().positive(),
    synthesisSeconds: z.number().nonnegative(),
    audioBase64: z.string().min(1),
    segments: z.array(Segment),
  }),
  z.object({ type: z.literal("error"), error: z.object({ code: z.string(), message: z.string() }) }),
]);

const ErrorResponse = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

const decoded = (segments: z.infer<typeof Segment>[]): NarrationSegment[] =>
  segments.map(({ index, durationSeconds, audioBase64 }) => ({ index, durationSeconds, audio: Buffer.from(audioBase64, "base64") }));

const ndjsonLines = async function* (body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let pending = "";
  const reader = body.getReader();
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    pending += decoder.decode(read.value, { stream: true });
    let newline = pending.indexOf("\n");
    while (newline !== -1) {
      yield pending.slice(0, newline);
      pending = pending.slice(newline + 1);
      newline = pending.indexOf("\n");
    }
  }
  if (pending.trim() !== "") {
    yield pending;
  }
};

// The service streams one event a line: docs/features/tts-pre-rendered-speech.md, "Streaming".
export const createHttpNarrator = (baseUrl: string, fetchImpl: typeof fetch = fetch): Narrator => {
  const root = baseUrl.replace(/\/+$/, "");
  return {
    async warm(requestId) {
      const response = await fetchImpl(`${root}/health`, {
        headers: { [REQUEST_ID_HEADER]: requestId },
        signal: AbortSignal.timeout(WARM_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`TTS answered ${response.status} to a warm-up`);
      }
    },
    async narrate(request, requestId, onLine) {
      const response = await fetchImpl(`${root}/render/stream`, {
        method: "POST",
        headers: { "content-type": "application/json", [REQUEST_ID_HEADER]: requestId },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
      });
      if (!response.ok || response.body === null) {
        const body: unknown = await response.json().catch(() => null);
        const error = ErrorResponse.safeParse(body);
        throw new Error(
          error.success
            ? `TTS refused the render: ${error.data.error.code}: ${error.data.error.message}`
            : `TTS answered ${response.status}`,
        );
      }
      for await (const line of ndjsonLines(response.body)) {
        const event = StreamEvent.parse(JSON.parse(line));
        if (event.type === "error") {
          throw new Error(`TTS failed partway: ${event.error.code}: ${event.error.message}`);
        }
        if (event.type === "line") {
          await onLine({ lineIndex: event.index, startSeconds: event.startSeconds, segments: decoded(event.segments) });
          continue;
        }
        if (event.renderVersion !== request.renderVersion) {
          throw new Error(`TTS rendered version ${event.renderVersion}, not ${request.renderVersion}`);
        }
        if (event.lineStartsSeconds.length !== request.lines.length) {
          throw new Error(`TTS timed ${event.lineStartsSeconds.length} lines of ${request.lines.length}`);
        }
        return {
          lineStartsSeconds: event.lineStartsSeconds,
          durationSeconds: event.durationSeconds,
          synthesisSeconds: event.synthesisSeconds,
          audio: Buffer.from(event.audioBase64, "base64"),
          trailingSegments: decoded(event.segments),
        };
      }
      throw new Error("TTS stopped before the render finished");
    },
  };
};
