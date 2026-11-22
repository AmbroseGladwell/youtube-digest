import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { useChipFit } from "../../useChipFit.js";
import styles from "./ChatChipRow.module.scss";
import { chatChipRowTestIds } from "./ChatChipRowTestIds.js";

const MOST_SHOWN = 2;

export interface ChatChipRowProps {
  chips: readonly ReactNode[];
  labels: readonly string[];
  align?: "start" | "end";
  testId?: string;
}

export const ChatChipRow = ({ chips, labels, align = "start", testId }: ChatChipRowProps) => {
  const [open, setOpen] = useState(false);
  const { rowRef, moreRef, measuring, shown } = useChipFit(labels, MOST_SHOWN);
  const menu = useRef<HTMLDivElement | null>(null);
  const [toEnd, setToEnd] = useState(align === "end");
  useDismissOnOutside(open, () => setOpen(false), moreRef);

  // The menu opens toward whichever side has room, so it never runs off a phone's screen (OV-368).
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const hostBox = moreRef.current?.getBoundingClientRect();
    const width = menu.current?.offsetWidth ?? 0;
    if (hostBox === undefined) {
      return;
    }
    const roomRight = window.innerWidth - hostBox.left;
    const roomLeft = hostBox.right;
    setToEnd(align === "end" ? roomLeft >= width || roomLeft >= roomRight : roomRight < width && roomLeft > roomRight);
  }, [open, align]);

  const hidden = measuring ? chips.length : chips.length - shown;
  return (
    <div
      ref={rowRef}
      className={`${styles.root} ${align === "end" ? styles.end : ""} ${measuring ? styles.measuring : ""}`}
      data-testid={testId ?? chatChipRowTestIds.root}
    >
      {chips.slice(0, shown).map((chip, index) => (
        <span key={index} className={styles.slot} data-chip-slot>
          {chip}
        </span>
      ))}
      {hidden > 0 && (
        <span className={styles.moreHost} ref={moreRef}>
          <button
            type="button"
            className={styles.more}
            aria-haspopup="true"
            aria-expanded={open}
            aria-label={`${hidden} more: ${labels.slice(shown).join(", ")}`}
            onClick={() => setOpen(!open)}
            data-testid={chatChipRowTestIds.more}
          >
            +{hidden}
          </button>
          {open && !measuring && (
            <div ref={menu} className={`${styles.menu} ${toEnd ? styles.menuEnd : ""}`} role="group" data-testid={chatChipRowTestIds.menu}>
              {chips}
            </div>
          )}
        </span>
      )}
    </div>
  );
};
