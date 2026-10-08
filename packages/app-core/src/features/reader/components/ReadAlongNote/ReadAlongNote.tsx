import { Fragment, type ReactNode } from "react";
import type { NoteLine, TimeRange } from "@overview/domain";
import { useOverviewPageAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import { sectionHeadingAt } from "../../../player/util/playerBarView.js";
import { useFollowTheVoice } from "./useFollowTheVoice.js";
import styles from "./ReadAlongNote.module.scss";
import { readAlongNoteTestIds } from "./ReadAlongNoteTestIds.js";

export interface ReadAlongNoteProps {
  lines: NoteLine[];
  activeIndex: number;
  // Whether the note is being read aloud right now. The page follows the voice and
  // nothing else: a note opened in silence stays where it was opened.
  speaking: boolean;
  onSelectLine: (index: number) => void;
  captions?: Record<string, string>;
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

export function ReadAlongNote({
  lines,
  activeIndex,
  speaking,
  onSelectLine,
  captions = {},
  renderRange,
}: ReadAlongNoteProps) {
  const analytics = useOverviewPageAnalytics();
  const numbers = numberListLines(lines);
  const follow = useFollowTheVoice(speaking);

  const select = (index: number) => {
    analytics.readAlong.lineChosen();
    onSelectLine(index);
  };

  const followTheVoice = () => {
    analytics.readAlong.followResumed();
    follow.follow();
  };

  return (
    <div className={styles.root} data-testid={readAlongNoteTestIds.root}>
      {lines.map((line, index) => {
        const active = index === activeIndex;
        const caption = lines[index + 1]?.section === line.section ? undefined : captions[line.section];
        return (
          <Fragment key={`${line.section}-${index}`}>
            <div
              ref={active ? follow.spokenLine : undefined}
              className={`${styles.line} ${line.heading ? styles.headingLine : styles.bodyLine} ${
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
                {line.label && (
                  <span className={styles.lineLabel} data-testid={readAlongNoteTestIds.lineLabel}>
                    {line.label}
                  </span>
                )}
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
                {line.chip && (
                  <span className={styles.chip} data-testid={readAlongNoteTestIds.chip}>
                    {line.chip}
                  </span>
                )}
                {line.range && renderRange?.(line, line.range, active)}
              </span>
            </div>
            {caption && (
              <p className={styles.caption} data-testid={readAlongNoteTestIds.caption}>
                {caption}
              </p>
            )}
          </Fragment>
        );
      })}

      {/* The way back to the line being read, the transcript's own way back worded for a
          voice instead of a clock, sitting above the player bar rather than on it. */}
      {follow.offered && (
        <button
          type="button"
          className={styles.followButton}
          onClick={followTheVoice}
          data-testid={readAlongNoteTestIds.followButton}
        >
          <span className={styles.followButtonMark} aria-hidden="true" />
          Back to {sectionHeadingAt(lines, activeIndex)}
        </button>
      )}
    </div>
  );
}
