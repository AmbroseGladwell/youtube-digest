import type { TranscriptSegment } from "@overview/domain";

export interface Passage {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export function transcriptPassages(segments: readonly TranscriptSegment[], windowMs: number): Passage[] {
  const passages: Passage[] = [];
  let current: TranscriptSegment[] = [];

  const close = () => {
    const first = current[0];
    const last = current.at(-1);
    if (first === undefined || last === undefined) {
      return;
    }
    passages.push({
      id: `p${passages.length + 1}`,
      startMs: first.startMs,
      endMs: last.endMs,
      text: current
        .map((segment) => segment.text.trim())
        .filter((text) => text.length > 0)
        .join(" "),
    });
    current = [];
  };

  for (const segment of segments) {
    const opening = current[0];
    if (opening !== undefined && segment.startMs - opening.startMs >= windowMs) {
      close();
    }
    current.push(segment);
  }
  close();
  return passages;
}

export const clockOf = (ms: number): string => {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
};

export const passageBlock = (passage: Passage): string => `[${passage.id} ${clockOf(passage.startMs)}] ${passage.text}`;
