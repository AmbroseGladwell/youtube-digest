import type { CSSProperties } from "react";
import type { MilestoneId } from "@overview/domain";

// Points the --milestone-tint/-ring/-ink a component paints with at one milestone's tokens
// in theme/tokens.scss, so each theme answers with its own colours.
export const milestoneColourStyle = (id: MilestoneId): CSSProperties =>
  ({
    "--milestone-tint": `var(--milestone-${id}-tint)`,
    "--milestone-ring": `var(--milestone-${id}-ring)`,
    "--milestone-ink": `var(--milestone-${id}-ink)`,
  }) as CSSProperties;
