import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { useChipFit } from "../../useChipFit.js";
import { clippingEdges, menuShift } from "../../util/menuShift.js";
import styles from "./ChatChipRow.module.scss";
import { chatChipRowTestIds } from "./ChatChipRowTestIds.js";

const MOST_SHOWN = 2;
const MENU_EDGES = 32;

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
  const [place, setPlace] = useState<{ shift: number; room: number } | null>(null);
  useDismissOnOutside(open, () => setOpen(false), moreRef);

  // The menu opens toward whichever side has room and is kept inside the screen and its panel (OV-368).
  useLayoutEffect(() => {
    if (!open) {
      setPlace(null);
      return;
    }
    const host = moreRef.current;
    if (host === null) {
      return;
    }
    const bounds = clippingEdges(host);
    setPlace({
      shift: menuShift(host.getBoundingClientRect(), menu.current?.offsetWidth ?? 0, bounds, align),
      room: bounds.right - bounds.left - MENU_EDGES,
    });
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
            <div
              ref={menu}
              className={`${styles.menu} ${place !== null && place.shift < 0 ? styles.menuEnd : ""}`}
              style={place === null ? { visibility: "hidden" } : { left: `${place.shift}px`, maxWidth: `min(320px, ${place.room}px)` }}
              role="group"
              data-testid={chatChipRowTestIds.menu}
            >
              {chips}
            </div>
          )}
        </span>
      )}
    </div>
  );
};
