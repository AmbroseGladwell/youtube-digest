import type { TranscriptSegment } from "@overview/domain";
import { z } from "zod";
import { htmlToText } from "./htmlToText.js";

export type PodcastTranscriptFormat = "vtt" | "srt" | "json" | "html" | "text";

const FORMAT_BY_TYPE: Record<string, PodcastTranscriptFormat> = {
  "text/vtt": "vtt",
  "application/srt": "srt",
  "application/x-subrip": "srt",
  "text/srt": "srt",
  "application/json": "json",
  "text/html": "html",
  "text/plain": "text",
};

// Timed cues before anything else, then word timings, then paragraph times; the order the
// formats are tried in when an episode offers several (docs/features/podcast-transcripts.md).
export const FORMAT_PREFERENCE: readonly PodcastTranscriptFormat[] = ["vtt", "srt", "json", "html", "text"];

export const podcastTranscriptFormat = (type: string): PodcastTranscriptFormat | null =>
  FORMAT_BY_TYPE[type.split(";")[0]!.trim().toLowerCase()] ?? null;

const MOST_SHARE_OUT_OF_ORDER = 0.02;
const CLOCK = /(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?/;
const MOST_WORDS_IN_A_LINE = 30;
const LONGEST_PAUSE_IN_A_LINE_MS = 1500;

function clockMs(text: string): number | null {
  const match = CLOCK.exec(text.trim());
  if (match === null) return null;
  const [, hours, minutes, seconds, fraction] = match;
  return ((Number(hours ?? 0) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000 + Number((fraction ?? "0").padEnd(3, "0"));
}

const spokenText = (markup: string): string =>
  htmlToText(markup.replace(/<v(?:\.[^\s>]*)?\s+[^>]*>/g, ""))
    .replace(/\n/g, " ")
    .trim();

function cues(text: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  for (const block of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const timing = lines.findIndex((line) => line.includes("-->"));
    if (timing === -1) continue;
    const [start, end] = lines[timing]!.split("-->");
    const startMs = clockMs(start ?? "");
    const endMs = clockMs(end ?? "");
    const words = spokenText(lines.slice(timing + 1).join("\n"));
    if (startMs === null || endMs === null || words === "") continue;
    segments.push({ text: words, startMs, endMs });
  }
  return segments;
}

const JsonTranscript = z.object({
  segments: z.array(
    z.object({ startTime: z.number().nonnegative(), endTime: z.number().nonnegative(), body: z.string(), speaker: z.string().optional() }),
  ),
});

// Hosts often time every word. Words are joined into lines at a sentence's end, a speaker's
// change or a pause, so a line reads like a caption.
function wordTimings(text: string): TranscriptSegment[] {
  let parsed: z.infer<typeof JsonTranscript>;
  try {
    parsed = JsonTranscript.parse(JSON.parse(text));
  } catch {
    return [];
  }
  const segments: TranscriptSegment[] = [];
  let line: { words: string[]; startMs: number; endMs: number; speaker: string | undefined } | null = null;
  const close = () => {
    if (line !== null && line.words.length > 0) segments.push({ text: line.words.join(" "), startMs: line.startMs, endMs: line.endMs });
    line = null;
  };
  for (const { startTime, endTime, body, speaker } of parsed.segments) {
    const words = body.trim();
    if (words === "") continue;
    const startMs = Math.round(startTime * 1000);
    const endMs = Math.max(startMs, Math.round(endTime * 1000));
    if (line !== null && (speaker !== line.speaker || startMs - line.endMs > LONGEST_PAUSE_IN_A_LINE_MS)) close();
    line ??= { words: [], startMs, endMs, speaker };
    line.words.push(words);
    line.endMs = endMs;
    if (/[.?!]["”’)]?$/.test(words) || line.words.length >= MOST_WORDS_IN_A_LINE) close();
  }
  close();
  return segments;
}

// A paragraph's time is where it starts. It ends there too, rather than where the next one
// begins, because no end was given (docs/features/transcript-retrieval.md, "Cue times").
function paragraphTimes(text: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  for (const match of text.matchAll(/<time>([^<]+)<\/time>\s*<p>([\s\S]*?)<\/p>/gi)) {
    const startMs = clockMs(match[1]!);
    const words = spokenText(match[2]!);
    if (startMs !== null && words !== "") segments.push({ text: words, startMs, endMs: startMs });
  }
  return segments;
}

function timedText(text: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let current: { startMs: number; lines: string[] } | null = null;
  const close = () => {
    const words = current?.lines.join(" ").replace(/\s+/g, " ").trim() ?? "";
    if (current !== null && words !== "") segments.push({ text: words, startMs: current.startMs, endMs: current.startMs });
  };
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*(\d+:)?\d{1,2}:\d{2}([.,]\d+)?\s*$/.test(line)) {
      close();
      current = { startMs: clockMs(line)!, lines: [] };
    } else if (current !== null) {
      current.lines.push(line);
    }
  }
  close();
  return segments;
}

// Hosts' cue times sometimes run backwards for a few seconds, where an ad was spliced in. Those
// cues are dropped rather than the whole file, unless there are enough of them to distrust it
// (docs/features/podcast-transcripts.md, "Times that run backwards").
function inOrder(segments: TranscriptSegment[]): TranscriptSegment[] {
  const kept: TranscriptSegment[] = [];
  for (const segment of segments) {
    if (segment.endMs >= segment.startMs && segment.startMs >= (kept.at(-1)?.startMs ?? 0)) kept.push(segment);
  }
  return segments.length - kept.length > MOST_SHARE_OUT_OF_ORDER * segments.length ? [] : kept;
}

// An untimed transcript gives nothing to link a point to, so it reads as no transcript here.
export function parsePodcastTranscript(text: string, format: PodcastTranscriptFormat): TranscriptSegment[] {
  return inOrder(segmentsOf(text, format));
}

function segmentsOf(text: string, format: PodcastTranscriptFormat): TranscriptSegment[] {
  switch (format) {
    case "vtt":
    case "srt":
      return cues(text);
    case "json":
      return wordTimings(text);
    case "html":
      return paragraphTimes(text);
    case "text":
      return timedText(text);
  }
}
