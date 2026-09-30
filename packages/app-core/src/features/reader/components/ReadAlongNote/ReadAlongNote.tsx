import { useEffect, useRef } from "react";
import type { NoteLine } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./ReadAlongNote.module.scss";
import { readAlongNoteTestIds } from "./ReadAlongNoteTestIds.js";

export interface ReadAlongNoteProps {
  lines: NoteLine[];
  activeIndex: number;
  // Design 2b: where each line starts in the narration, shown beside a line under the
  // pointer. Null when there is no narration to seek, which is the pacer's case.
  lineStartLabels?: string[] | null;
  onSelectLine: (index: number) => void;
}

// Design 4a numbers the key points rather than bulleting them, so each list line carries
// its place in its own section. Counted here, from the lines, and never spoken: the mark
// stays out of `text` (docs/features/stone-theme.md, "The single overview").
const numberListLines = (lines: NoteLine[]): Array<number | null> => {
  let count = 0;
  return lines.map((line) => {
    if (line.heading) {
      count = 0;
    }
    if (!line.bullet) {
      return null;
    }
    count += 1;
    return count;
  });
};

// Design 1a: the page scrolls to keep the sentence being read in the top third. A line
// already resting there is left alone, so a listener who has not touched the page sees
// the tint walk down and the page catch up, never a jump per sentence
// (docs/features/stone-theme.md, "Highlighting").
const TOP_THIRD = 1 / 3;
const LOWEST_RESTING = 0.45;

const keepInTopThird = (line: HTMLElement) => {
  const rect = line.getBoundingClientRect();
  const stickyTop = parseFloat(getComputedStyle(line).scrollMarginTop) || 0;
  const viewport = window.innerHeight;
  const resting = rect.top >= stickyTop && rect.top <= viewport * LOWEST_RESTING && rect.bottom < viewport - viewport * TOP_THIRD;
  if (resting) {
    return;
  }
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  line.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
};

export function ReadAlongNote({ lines, activeIndex, lineStartLabels = null, onSelectLine }: ReadAlongNoteProps) {
  const activeLine = useRef<HTMLButtonElement | null>(null);
  const numbers = numberListLines(lines);

  useEffect(() => {
    if (activeLine.current) {
      keepInTopThird(activeLine.current);
    }
  }, [activeIndex]);

  return (
    <div className={styles.root} data-testid={readAlongNoteTestIds.root}>
      {lines.map((line, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={`${line.section}-${index}`}
            type="button"
            ref={active ? activeLine : null}
            className={`${styles.line} ${line.heading ? styles.headingLine : styles.bodyLine} ${
              line.bullet ? styles.bulletLine : ""
            } ${active ? styles.lineActive : ""}`}
            aria-current={active}
            onClick={() => onSelectLine(index)}
            data-testid={active ? readAlongNoteTestIds.activeLine : readAlongNoteTestIds.line}
          >
            {lineStartLabels?.[index] !== undefined && (
              <span className={styles.startTime} aria-hidden="true" data-testid={readAlongNoteTestIds.startTime}>
                <StrokeIcon name="circlePlay" size={13} />
                {lineStartLabels[index]}
              </span>
            )}
            {line.bullet && (
              <span
                className={styles.bullet}
                aria-hidden="true"
                data-testid={readAlongNoteTestIds.bullet}
              >
                {numbers[index]}.
              </span>
            )}
            <span className={styles.lineText} data-testid={readAlongNoteTestIds.lineText}>
              {line.text}
            </span>
          </button>
        );
      })}
    </div>
  );
}
