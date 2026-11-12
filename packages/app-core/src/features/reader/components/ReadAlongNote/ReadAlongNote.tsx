import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { SOURCE_STEPS_SECTION, formatTimestamp, type NoteLine, type TimeRange } from "@overview/domain";
import { DubiousStepFlag } from "../DubiousStepFlag/DubiousStepFlag.js";
import { useOverviewPageAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import { sectionHeadingAt } from "../../../player/util/playerBarView.js";
import { useFollowTheVoice } from "./useFollowTheVoice.js";
import styles from "./ReadAlongNote.module.scss";
import { readAlongNoteTestIds } from "./ReadAlongNoteTestIds.js";

// Something a section carries beside its heading and under it. With replacement set, that
// stands in for the section's lines, which stay in the list so the voice keeps its place.
export interface NoteSectionSlot {
  section: string;
  beside: ReactNode;
  under: ReactNode;
  replacement: ReactNode | null;
}

export interface ReadAlongNoteProps {
  lines: NoteLine[];
  activeIndex: number;
  // Whether the note is being read aloud right now. The page follows the voice and
  // nothing else: a note opened in silence stays where it was opened.
  speaking: boolean;
  onSelectLine: (index: number) => void;
  captions?: Record<string, string>;
  sectionSlot?: NoteSectionSlot | null;
  renderRange?: (line: NoteLine, range: TimeRange, active: boolean) => ReactNode;
  renderLineEnd?: (line: NoteLine) => ReactNode;
  // The line whose stretch holds the playhead of the video beside the panel (design 250e).
  playingIndex?: number | null;
}

// Design 250m: past eight steps, the first five and a way to show the rest. Most lists are six
// to eight long and show whole.
const MOST_STEPS_SHOWN_WHOLE = 8;
const STEPS_SHOWN_FIRST = 5;

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
  sectionSlot = null,
  renderRange,
  renderLineEnd,
  playingIndex = null,
}: ReadAlongNoteProps) {
  const analytics = useOverviewPageAnalytics();
  const numbers = numberListLines(lines);
  const follow = useFollowTheVoice(speaking);
  const root = useRef<HTMLDivElement | null>(null);

  // The rest of a long list opens by itself for the voice, the playhead, or the browser's
  // find-in-page, and stays in the page while shut so every step can be found.
  const stepIndexes = lines.flatMap((line, index) => (line.section === SOURCE_STEPS_SECTION && !line.heading ? [index] : []));
  const beyondFirst = stepIndexes.length > MOST_STEPS_SHOWN_WHOLE ? stepIndexes.slice(STEPS_SHOWN_FIRST) : [];
  const [stepsShown, setStepsShown] = useState(false);
  const reached = beyondFirst.includes(activeIndex) || (playingIndex !== null && beyondFirst.includes(playingIndex));
  const collapsed = new Set(stepsShown || reached ? [] : beyondFirst);
  const firstCollapsed = beyondFirst[0];
  const lastStepIndex = stepIndexes.at(-1);
  const lastStep = lastStepIndex === undefined ? undefined : lines[lastStepIndex];

  useLayoutEffect(() => {
    root.current?.querySelectorAll<HTMLElement>("[data-read-along-line]").forEach((element) => {
      if (element.dataset.collapsed === "true") element.setAttribute("hidden", "until-found");
      else element.removeAttribute("hidden");
    });
  });
  useEffect(() => {
    const element = root.current;
    const open = () => setStepsShown(true);
    element?.addEventListener("beforematch", open);
    return () => element?.removeEventListener("beforematch", open);
  }, []);

  const showAllSteps = () => {
    analytics.sourceSteps.allShown({ steps: stepIndexes.length });
    setStepsShown(true);
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLElement>(`[data-line-index="${firstCollapsed}"] [data-testid="${readAlongNoteTestIds.lineText}"]`)
        ?.focus(),
    );
  };

  const select = (index: number) => {
    analytics.readAlong.lineChosen();
    onSelectLine(index);
  };

  const followTheVoice = () => {
    analytics.readAlong.followResumed();
    follow.follow();
  };

  return (
    <div className={styles.root} ref={root} data-testid={readAlongNoteTestIds.root}>
      {lines.map((line, index) => {
        const active = index === activeIndex;
        const playing = index === playingIndex;
        const step = line.section === SOURCE_STEPS_SECTION && !line.heading;
        const caption = lines[index + 1]?.section === line.section ? undefined : captions[line.section];
        const slot = sectionSlot?.section === line.section ? sectionSlot : null;
        if (slot?.replacement && !line.heading) return null;
        return (
          <Fragment key={`${line.section}-${index}`}>
            <div
              ref={active ? follow.spokenLine : undefined}
              className={`${styles.line} ${line.heading ? styles.headingLine : styles.bodyLine} ${
                line.bullet ? styles.bulletLine : ""
              } ${line.heading && (slot || line.aside) ? styles.headingWithSlot : ""} ${active ? styles.lineActive : ""} ${
                step ? styles.stepLine : ""
              } ${playing ? styles.linePlaying : ""}`}
              onClick={() => select(index)}
              aria-current={playing ? "step" : undefined}
              data-read-along-line
              data-line-index={index}
              data-collapsed={collapsed.has(index) ? "true" : undefined}
              data-testid={active ? readAlongNoteTestIds.activeLine : readAlongNoteTestIds.line}
            >
              {line.bullet &&
                (step ? (
                  <span className={styles.stepNumber} aria-hidden="true" data-testid={readAlongNoteTestIds.stepNumber}>
                    {numbers[index]}
                  </span>
                ) : stepIndexes.length > 0 ? (
                  <span className={styles.dot} aria-hidden="true" data-testid={readAlongNoteTestIds.bullet} />
                ) : (
                  <span className={styles.bullet} aria-hidden="true" data-testid={readAlongNoteTestIds.bullet}>
                    {numbers[index]}.
                  </span>
                ))}
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
                {renderLineEnd?.(line)}
                {line.dubiousReason !== undefined && <DubiousStepFlag reason={line.dubiousReason} saidAtMs={line.range?.startMs ?? null} />}
              </span>
              {line.aside && (
                <span className={styles.aside} data-testid={readAlongNoteTestIds.aside}>
                  {line.aside}
                </span>
              )}
              {line.heading && slot && (
                <span className={styles.slotBeside} onClick={(event) => event.stopPropagation()}>
                  {slot.beside}
                </span>
              )}
            </div>
            {line.heading && slot?.under}
            {line.heading && slot?.replacement}
            {index === lastStepIndex && collapsed.size > 0 && (
              <button
                type="button"
                className={styles.showAllSteps}
                aria-expanded={false}
                onClick={showAllSteps}
                data-testid={readAlongNoteTestIds.showAllSteps}
              >
                Show all {stepIndexes.length} steps
                <small>
                  {collapsed.size} more
                  {lastStep?.range ? `, up to ${formatTimestamp(lastStep.range.startMs)}` : ""}
                </small>
              </button>
            )}
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
        <button type="button" className={styles.followButton} onClick={followTheVoice} data-testid={readAlongNoteTestIds.followButton}>
          <span className={styles.followButtonMark} aria-hidden="true" />
          Back to {sectionHeadingAt(lines, activeIndex)}
        </button>
      )}
    </div>
  );
}
