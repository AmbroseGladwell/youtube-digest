import { SourceSteps, type SourceStep } from "@overview/domain";

export type WrittenSourceStep = Omit<SourceStep, "dubiousReason"> & { dubious: boolean; dubiousReason: string };

export const sourceStepsOf = (steps: WrittenSourceStep[]): SourceSteps | null => {
  const items = steps
    .map(({ text, range, dubious, dubiousReason }) => {
      const reason = dubiousReason.trim();
      return { text: text.trim(), range, dubiousReason: dubious && reason !== "" ? reason : null };
    })
    .filter(({ text }) => text !== "");
  return items.length === 0 ? null : SourceSteps.parse({ items });
};
