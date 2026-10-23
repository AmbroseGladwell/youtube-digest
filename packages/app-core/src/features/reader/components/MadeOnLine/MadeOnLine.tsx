import type { Overview } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { madeOnLine } from "../../util/madeOnLine.js";
import styles from "./MadeOnLine.module.scss";
import { madeOnLineTestIds } from "./MadeOnLineTestIds.js";

// On the byline's scale, under the playlist line: provenance, not a warning. Only a
// fallback earns it (docs/architecture/tiers.md, "Which key an overview uses").
export function MadeOnLine({ overview }: { overview: Overview }) {
  const line = madeOnLine(overview.madeOn);
  return line === null ? null : (
    <p className={styles.root} data-testid={madeOnLineTestIds.root}>
      <span className={styles.icon} aria-hidden="true">
        <StrokeIcon name="key" size={15} />
      </span>
      <span>{line}</span>
    </p>
  );
}
