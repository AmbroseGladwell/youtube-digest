import { TranscriptSegment } from "@overview/domain";
import { TranscriptFetchFailure } from "../TranscriptFetchFailure.js";
import { innerTubeError } from "./innerTubeFailure.js";

interface Json3Segment {
  utf8?: string;
}

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  // 1 on a rolling-append event, which repeats words already carried by another cue.
  aAppend?: number;
  segs?: Json3Segment[];
}

// A 200 with no events at all is what a caption URL looks like once it has been gated,
// which is the source being turned away rather than a video without captions
// (docs/features/transcript-retrieval.md).
export function mapJson3ToSegments(body: string): TranscriptSegment[] {
  let parsed: { events?: Json3Event[] };
  try {
    parsed = JSON.parse(body) as { events?: Json3Event[] };
  } catch (error) {
    throw innerTubeError(
      "the caption track was not json3",
      TranscriptFetchFailure.MALFORMED_RESPONSE,
      error,
    );
  }

  const events = parsed.events ?? [];
  const segments: TranscriptSegment[] = [];

  for (const event of events) {
    if (event.aAppend === 1 || !event.segs || event.tStartMs === undefined) continue;

    const text = event.segs.map((segment) => segment.utf8 ?? "").join("");
    if (text.trim() === "") continue;

    // endMs is the start plus YouTube's own duration, never the next cue's start and
    // never a length inferred from the words. A cue with no duration is a cue we were
    // not told the length of (docs/prototype/constraints.md).
    segments.push(
      TranscriptSegment.parse({
        text,
        startMs: Math.round(event.tStartMs),
        endMs: Math.round(event.tStartMs + (event.dDurationMs ?? 0)),
      }),
    );
  }

  if (segments.length === 0) {
    throw innerTubeError(
      "the caption track came back empty",
      TranscriptFetchFailure.SOURCE_BLOCKED,
    );
  }
  return segments;
}
