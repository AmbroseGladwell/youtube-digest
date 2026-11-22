import { useRef, useState, type ReactNode } from "react";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import styles from "./ChatChipRow.module.scss";
import { chatChipRowTestIds } from "./ChatChipRowTestIds.js";

export const VISIBLE_CHIPS = 2;

export interface ChatChipRowProps {
  chips: readonly ReactNode[];
  // What the hidden chips are, for "+N"'s accessible name: every title, never just a count.
  hiddenLabels: readonly string[];
  align?: "start" | "end";
  testId?: string;
}

// OV-362: a row of source chips that never runs long. Two show, then "+N", which opens a menu of
// every one, as the row above the field does (OV-354, page 1). Used for a section's sources by
// relation, a list item's, Pinned, Found for you and what a library answer read.
export function ChatChipRow({ chips, hiddenLabels, align = "start", testId }: ChatChipRowProps) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLSpanElement | null>(null);
  useDismissOnOutside(open, () => setOpen(false), host);
  const hidden = chips.length - VISIBLE_CHIPS;
  return (
    <div className={`${styles.root} ${align === "end" ? styles.end : ""}`} data-testid={testId ?? chatChipRowTestIds.root}>
      {chips.slice(0, VISIBLE_CHIPS)}
      {hidden > 0 && (
        <span className={styles.moreHost} ref={host}>
          <button
            type="button"
            className={styles.more}
            aria-haspopup="true"
            aria-expanded={open}
            aria-label={`${hidden} more: ${hiddenLabels.join(", ")}`}
            onClick={() => setOpen(!open)}
            data-testid={chatChipRowTestIds.more}
          >
            +{hidden}
          </button>
          {open && (
            <div className={`${styles.menu} ${align === "end" ? styles.menuEnd : ""}`} role="group" data-testid={chatChipRowTestIds.menu}>
              {chips}
            </div>
          )}
        </span>
      )}
    </div>
  );
}
