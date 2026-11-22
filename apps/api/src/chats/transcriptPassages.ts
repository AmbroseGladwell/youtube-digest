import type { TranscriptSegment } from "@overview/domain";

export interface Passage {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

// A minute of transcript each, the size OV-267 measured: a citation lands within a minute
// (docs/architecture/in-app-chat.md, "Retrieval, measured first").
export const PASSAGE_WINDOW_MS = 60_000;

export const transcriptPassages = (segments: readonly TranscriptSegment[], windowMs = PASSAGE_WINDOW_MS): Passage[] => {
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
};
