import type { TranscriptSegment } from "@overview/domain";

const normalised = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function locateQuote(segments: readonly TranscriptSegment[], quote: string): number | null {
  const wanted = normalised(quote);
  if (wanted.length === 0) return null;
  let joined = "";
  const startsAt: { offset: number; startMs: number }[] = [];
  for (const segment of segments) {
    const text = normalised(segment.text);
    if (text.length === 0) continue;
    if (joined.length > 0) joined += " ";
    startsAt.push({ offset: joined.length, startMs: segment.startMs });
    joined += text;
  }
  const found = joined.indexOf(wanted);
  if (found === -1) return null;
  let startMs = startsAt[0]?.startMs ?? 0;
  for (const start of startsAt) {
    if (start.offset > found) break;
    startMs = start.startMs;
  }
  return startMs;
}
