import type { NoteTiming } from "./noteTiming.js";

// The design's "4 min read · 6 min listen · 11:38 video". The last term is dropped rather
// than guessed when the source has no length (docs/prototype/constraints.md).
export function readerMetaParts(timing: NoteTiming, sourceLength: string | null): string[] {
  const parts = [`${timing.readMinutes} min read`, `${timing.listenMinutes} min listen`];
  if (sourceLength !== null) {
    parts.push(sourceLength);
  }
  return parts;
}
