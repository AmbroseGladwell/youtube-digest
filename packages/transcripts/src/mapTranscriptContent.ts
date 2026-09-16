import type { Transcript } from "@supadata/js";
import { TranscriptSegment } from "@digest/types";
import { TranscriptFetchError } from "./TranscriptFetchError.js";

export function mapTranscriptContent(content: Transcript["content"]): TranscriptSegment[] {
  if (typeof content === "string") {
    throw new TranscriptFetchError(
      "expected timed transcript chunks (text: false) but got a plain string",
      { retryable: false },
    );
  }
  return content.map((chunk) =>
    TranscriptSegment.parse({
      text: chunk.text,
      startMs: Math.round(chunk.offset),
      endMs: Math.round(chunk.offset + chunk.duration),
    }),
  );
}
