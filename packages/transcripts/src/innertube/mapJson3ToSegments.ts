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

// No events at all is a gated caption URL: the source turned away, not a video without captions.
export const mapJson3ToSegments = (body: string): TranscriptSegment[] => {
  let parsed: { events?: Json3Event[] };
  try {
    parsed = JSON.parse(body) as { events?: Json3Event[] };
  } catch (error) {
    throw innerTubeError("the caption track was not json3", TranscriptFetchFailure.MALFORMED_RESPONSE, error);
  }

  const events = parsed.events ?? [];
  const segments: TranscriptSegment[] = [];

  for (const event of events) {
    if (event.aAppend === 1 || !event.segs || event.tStartMs === undefined) {
      continue;
    }

    const text = event.segs.map((segment) => segment.utf8 ?? "").join("");
    if (text.trim() === "") {
      continue;
    }

    // docs/prototype/constraints.md, "Never let a model count, measure or time anything".
    segments.push(
      TranscriptSegment.parse({
        text,
        startMs: Math.round(event.tStartMs),
        endMs: Math.round(event.tStartMs + (event.dDurationMs ?? 0)),
      }),
    );
  }

  if (segments.length === 0) {
    throw innerTubeError("the caption track came back empty", TranscriptFetchFailure.SOURCE_BLOCKED);
  }
  return segments;
};
