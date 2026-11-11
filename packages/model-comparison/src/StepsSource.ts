import { formatTimestamp } from "@overview/domain";
import type { FetchedTranscript } from "@overview/transcripts";

// A source as the steps check reads it: numbered units of its text, and where each one is, so
// the check works the same on a transcript's segments now and an article's sentences later
// (OV-251; the position space OV-202's coverage measure already takes).
export interface StepsSource {
  sourceId: string;
  title: string;
  units: readonly string[];
  placeOf: (unit: number) => string;
}

export const videoStepsSource = (fetched: FetchedTranscript): StepsSource => ({
  sourceId: fetched.video.id ?? fetched.video.url,
  title: fetched.video.title,
  units: fetched.transcript.map(({ text }) => text),
  placeOf: (unit) => formatTimestamp(fetched.transcript[unit]?.startMs ?? 0),
});
