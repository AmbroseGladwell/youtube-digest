import { SourceSteps, type SourceStep } from "@overview/domain";

export type WrittenSourceStep = Omit<SourceStep, "dubiousReason"> & { dubious: boolean; dubiousReason: string };

// No steps means the source gave no process, so the note has no block rather than an empty one
// (docs/features/source-steps.md).
export function sourceStepsOf(steps: WrittenSourceStep[]): SourceSteps | null {
  const items = steps
    .map(({ text, range, dubious, dubiousReason }) => {
      const reason = dubiousReason.trim();
      return { text: text.trim(), range, dubiousReason: dubious && reason !== "" ? reason : null };
    })
    .filter(({ text }) => text !== "");
  return items.length === 0 ? null : SourceSteps.parse({ items });
}
