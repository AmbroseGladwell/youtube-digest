import { SOURCE_STEPS_SECTION, type NoteLine } from "@overview/domain";

export interface SourceStepsStretch {
  first: number;
  after: number | null;
}

export const sourceStepsStretch = (lines: readonly NoteLine[]): SourceStepsStretch | null => {
  const first = lines.findIndex((line) => line.section === SOURCE_STEPS_SECTION);
  if (first === -1) {
    return null;
  }
  const after = lines.findIndex((line, index) => index > first && line.section !== SOURCE_STEPS_SECTION);
  return { first, after: after === -1 ? null : after };
};

export const isInSourceSteps = (stretch: SourceStepsStretch | null, line: number): boolean =>
  stretch !== null && line >= stretch.first && (stretch.after === null || line < stretch.after);
