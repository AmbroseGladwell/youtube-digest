import type { NoteTiming } from "./noteTiming.js";

// The design's "4 min read · 6 min listen · 11:38 video". The last term always names the kind,
// and carries a length only when the source has one (docs/prototype/constraints.md).
export const readerMetaParts = (timing: NoteTiming, sourceLength: string): string[] => [
  `${timing.readMinutes} min read`,
  `${timing.listenMinutes} min listen`,
  sourceLength,
];
