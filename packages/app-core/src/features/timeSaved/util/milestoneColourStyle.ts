import type { CSSProperties } from "react";
import type { MilestoneId } from "@overview/domain";

export const milestoneColourStyle = (id: MilestoneId): CSSProperties =>
  ({
    "--milestone-tint": `var(--milestone-${id}-tint)`,
    "--milestone-ring": `var(--milestone-${id}-ring)`,
    "--milestone-ink": `var(--milestone-${id}-ink)`,
  }) as CSSProperties;
