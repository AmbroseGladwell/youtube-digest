import { useEffect, useRef, type ReactNode } from "react";
import type { NoteLine, TimeRange } from "@overview/domain";
import { useOverviewPageAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import styles from "./ReadAlongNote.module.scss";
import { readAlongNoteTestIds } from "./ReadAlongNoteTestIds.js";

export interface ReadAlongNoteProps {
  lines: NoteLine[];
  activeIndex: number;
  onSelectLine: (index: number) => void;
  renderRange?: (line: NoteLine, range: TimeRange, active: boolean) => ReactNode;
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

export function ReadAlongNote({ lines, activeIndex, onSelectLine, renderRange }: ReadAlongNoteProps) {
  const activeLine = useRef<HTMLDivElement | null>(null);
  const analytics = useOverviewPageAnalytics();
  const numbers = numberListLines(lines);

  useEffect(() => {
    if (activeLine.current) {
      keepInTopThird(activeLine.current);
    }
  }, [activeIndex]);

  const select = (index: number) => {
    analytics.readAlong.lineChosen();
    onSelectLine(index);
  };

  return (
    <div className={styles.root} data-testid={readAlongNoteTestIds.root}>
      {lines.map((line, index) => {
        const active = index === activeIndex;
        return (
          <div
            key={`${line.section}-${index}`}
            ref={active ? activeLine : null}
            className={`${styles.line} ${line.heading ? styles.headingLine : line.footnote ? styles.footnoteLine : styles.bodyLine} ${
              line.bullet ? styles.bulletLine : ""
            } ${active ? styles.lineActive : ""}`}
            onClick={() => select(index)}
            data-read-along-line
            data-testid={active ? readAlongNoteTestIds.activeLine : readAlongNoteTestIds.line}
          >
            {line.bullet && (
              <span className={styles.bullet} aria-hidden="true" data-testid={readAlongNoteTestIds.bullet}>
                {numbers[index]}.
              </span>
            )}
            <span className={styles.lineBody}>
              <span
                role="button"
                tabIndex={0}
                className={styles.lineText}
                aria-current={active}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    select(index);
                  }
                }}
                data-testid={readAlongNoteTestIds.lineText}
              >
                {line.text}
              </span>
              {line.range && renderRange?.(line, line.range, active)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
