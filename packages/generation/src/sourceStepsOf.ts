import { SourceSteps, type SourceStep } from "@overview/domain";

// No steps means the source gave no process, so the note has no block rather than an empty one
// (docs/features/source-steps.md).
export function sourceStepsOf(steps: SourceStep[]): SourceSteps | null {
  const items = steps.map((step) => ({ ...step, text: step.text.trim() })).filter(({ text }) => text !== "");
  return items.length === 0 ? null : SourceSteps.parse({ items });
}
