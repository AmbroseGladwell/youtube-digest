import type { NoteTiming } from "./noteTiming.js";

// The last term always names the kind, and has a length only when the source has one.
export const readerMetaParts = (timing: NoteTiming, sourceLength: string): string[] => [
  `${timing.readMinutes} min read`,
  `${timing.listenMinutes} min listen`,
  sourceLength,
];
