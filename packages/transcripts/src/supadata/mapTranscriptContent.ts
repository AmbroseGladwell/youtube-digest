import type { Transcript } from "@supadata/js";
import { TranscriptSegment } from "@overview/domain";
import { TranscriptFetchError } from "../TranscriptFetchError.js";
import { TranscriptFetchFailure } from "../TranscriptFetchFailure.js";

export function mapTranscriptContent(content: Transcript["content"]): TranscriptSegment[] {
  if (typeof content === "string") {
    throw new TranscriptFetchError(
      "expected timed transcript chunks (text: false) but got a plain string",
      { failure: TranscriptFetchFailure.MALFORMED_RESPONSE },
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
