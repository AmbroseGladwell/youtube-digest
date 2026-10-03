import { z } from "zod";
import { REQUEST_ID_HEADER } from "@overview/domain";
import type { Narrator } from "./Narrator.js";

const RENDER_TIMEOUT_MS = 10 * 60 * 1000;

const RenderResponse = z.object({
  renderVersion: z.number().int(),
  lineStartsSeconds: z.array(z.number().nonnegative()),
  durationSeconds: z.number().positive(),
  synthesisSeconds: z.number().nonnegative(),
  audioBase64: z.string().min(1),
});

const ErrorResponse = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

export function createHttpNarrator(baseUrl: string, fetchImpl: typeof fetch = fetch): Narrator {
  return {
    async narrate(request, requestId) {
      const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/render`, {
        method: "POST",
        headers: { "content-type": "application/json", [REQUEST_ID_HEADER]: requestId },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = ErrorResponse.safeParse(body);
        throw new Error(
          error.success
            ? `TTS refused the render: ${error.data.error.code}: ${error.data.error.message}`
            : `TTS answered ${response.status}`,
        );
      }
      const rendered = RenderResponse.parse(body);
      if (rendered.renderVersion !== request.renderVersion) {
        throw new Error(`TTS rendered version ${rendered.renderVersion}, not ${request.renderVersion}`);
      }
      if (rendered.lineStartsSeconds.length !== request.lines.length) {
        throw new Error(`TTS timed ${rendered.lineStartsSeconds.length} lines of ${request.lines.length}`);
      }
      return {
        lineStartsSeconds: rendered.lineStartsSeconds,
        durationSeconds: rendered.durationSeconds,
        synthesisSeconds: rendered.synthesisSeconds,
        audio: Buffer.from(rendered.audioBase64, "base64"),
      };
    },
  };
}
