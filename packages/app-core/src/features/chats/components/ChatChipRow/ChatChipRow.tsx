import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { fittingChipCount } from "../../../../util/fittingChipCount.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import styles from "./ChatChipRow.module.scss";
import { chatChipRowTestIds } from "./ChatChipRowTestIds.js";

const MOST_SHOWN = 2;
const GAP = 6;
const LEAST_TITLE_SHOWN = 64;

export interface ChatChipRowProps {
  chips: readonly ReactNode[];
  // Every chip's title, in order: "+N"'s accessible name lists the hidden ones, never just a count.
  labels: readonly string[];
  align?: "start" | "end";
  testId?: string;
}

interface Measured {
  key: string;
  leastChipWidths: number[];
  moreWidth: number;
}

const pixels = (value: string) => Number.parseFloat(value) || 0;

const leastWidth = (slot: HTMLElement) => {
  const cuttable = slot.querySelector<HTMLElement>("[data-cuttable]")?.offsetWidth ?? 0;
  return slot.offsetWidth - Math.max(0, cuttable - LEAST_TITLE_SHOWN);
};

interface Room {
  box: HTMLElement | null;
  width: () => number;
}

const roomFor = (row: HTMLElement): Room => {
  let box = row.parentElement;
  let inlineMargins = 0;
  while (box !== null && getComputedStyle(box).display.startsWith("inline")) {
    const style = getComputedStyle(box);
    inlineMargins += pixels(style.marginLeft) + pixels(style.marginRight);
    box = box.parentElement;
  }
  const container = box;
  return {
    box: container,
    width: () => {
      if (container === null) {
        return Number.POSITIVE_INFINITY;
      }
      const style = getComputedStyle(container);
      return container.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight) - inlineMargins;
    },
  };
};

// OV-362: up to two chips that fit the line, titles cut if need be, then "+N" holding every one (OV-354, page 1).
export const ChatChipRow = ({ chips, labels, align = "start", testId }: ChatChipRowProps) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const host = useRef<HTMLSpanElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const measured = useRef<Measured | null>(null);
  const [toEnd, setToEnd] = useState(align === "end");
  const key = labels.join("\n");
  const [fit, setFit] = useState<{ key: string; shown: number } | null>(null);
  const measuring = fit?.key !== key;
  useDismissOnOutside(open, () => setOpen(false), host);

  useLayoutEffect(() => {
    const row = root.current;
    if (row === null || !measuring) {
      return;
    }
    measured.current = {
      key,
      leastChipWidths: [...row.querySelectorAll<HTMLElement>(":scope > [data-chip-slot]")].map(leastWidth),
      moreWidth: host.current?.offsetWidth ?? 0,
    };
  });

  useLayoutEffect(() => {
    const row = root.current;
    if (row === null) {
      return;
    }
    const room = roomFor(row);
    const refit = () => {
      const sizes = measured.current;
      if (sizes?.key !== key) {
        return;
      }
      const fitting = fittingChipCount(sizes.leastChipWidths, room.width(), sizes.moreWidth, GAP);
      setFit({ key, shown: Math.max(1, Math.min(MOST_SHOWN, fitting, sizes.leastChipWidths.length)) });
    };
    refit();
    if (room.box === null) {
      return;
    }
    const observer = new ResizeObserver(refit);
    observer.observe(room.box);
    return () => observer.disconnect();
  }, [key]);

  // The menu opens toward whichever side has room, so it never runs off a phone's screen (OV-368).
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const hostBox = host.current?.getBoundingClientRect();
    const width = menu.current?.offsetWidth ?? 0;
    if (hostBox === undefined) {
      return;
    }
    const roomRight = window.innerWidth - hostBox.left;
    const roomLeft = hostBox.right;
    setToEnd(align === "end" ? roomLeft >= width || roomLeft >= roomRight : roomRight < width && roomLeft > roomRight);
  }, [open, align]);

  const shown = measuring ? chips.length : fit.shown;
  const hidden = measuring ? chips.length : chips.length - shown;
  return (
    <div
      ref={root}
      className={`${styles.root} ${align === "end" ? styles.end : ""} ${measuring ? styles.measuring : ""}`}
      data-testid={testId ?? chatChipRowTestIds.root}
    >
      {chips.slice(0, shown).map((chip, index) => (
        <span key={index} className={styles.slot} data-chip-slot>
          {chip}
        </span>
      ))}
      {hidden > 0 && (
        <span className={styles.moreHost} ref={host}>
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
