import { formatTimestamp } from "@overview/domain";
import type { FetchedTranscript } from "@overview/transcripts";

// Numbered units, so the check reads a transcript's segments and an article's sentences alike (OV-251).
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
