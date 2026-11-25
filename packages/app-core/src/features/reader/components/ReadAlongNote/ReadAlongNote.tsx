import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  HOW_TO_APPLY_SECTION,
  KEY_POINTS_SECTION,
  SOURCE_STEPS_SECTION,
  READ_ANYWAY_SECTION,
  WATCH_ANYWAY_SECTION,
  formatTimestamp,
  type NoteLine,
  type OverviewPart,
  type TimeRange,
} from "@overview/domain";
import { citedPartProps, useCitedOverviewPart } from "../../../chats/CitedOverviewPartContext.js";
import { DubiousStepFlag } from "../DubiousStepFlag/DubiousStepFlag.js";
import { useOverviewPageAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import { sectionHeadingAt } from "../../../player/util/playerBarView.js";
import { prefersReducedMotion } from "../../../../util/prefersReducedMotion.js";
import { useFollowTheVoice } from "./useFollowTheVoice.js";
import styles from "./ReadAlongNote.module.scss";
import { readAlongNoteTestIds } from "./ReadAlongNoteTestIds.js";

export interface NoteSectionSlot {
  section: string;
  beside: ReactNode;
  under: ReactNode;
}

export interface ReadAlongNoteProps {
  lines: NoteLine[];
  activeIndex: number;
  speaking: boolean;
  onSelectLine: (index: number) => void;
  captions?: Record<string, string>;
  sectionSlot?: NoteSectionSlot | null;
  renderRange?: (line: NoteLine, range: TimeRange, active: boolean) => ReactNode;
  renderLineEnd?: (line: NoteLine) => ReactNode;
  playingIndex?: number | null;
  citedIndex?: number | null;
}

const MOST_STEPS_SHOWN_WHOLE = 8;
const STEPS_SHOWN_FIRST = 5;

// Counted here rather than kept in `text`, so the number is never spoken.
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

// The premise, big picture and core claim are never cited, so they have no part.
const SECTION_PART: Record<string, OverviewPart> = {
  Verdict: "verdict",
  [KEY_POINTS_SECTION]: "keyPoint",
  [SOURCE_STEPS_SECTION]: "step",
  [HOW_TO_APPLY_SECTION]: "howToApply",
  "What it sells": "selling",
  [WATCH_ANYWAY_SECTION]: "watchAnyway",
  [READ_ANYWAY_SECTION]: "watchAnyway",
};

const linePlaces = (lines: NoteLine[]): Array<number | "section"> => {
  let place = 0;
  return lines.map((line) => {
    if (line.heading) {
      place = 0;
      return "section";
    }
    return place++;
  });
};

interface LineMarkerProps {
  step: boolean;
  hasSteps: boolean;
  number: number | null | undefined;
}

const LineMarker = ({ step, hasSteps, number }: LineMarkerProps) => {
  if (step) {
    return (
      <span className={styles.stepNumber} aria-hidden="true" data-testid={readAlongNoteTestIds.stepNumber}>
        {number}
      </span>
    );
  }
  if (hasSteps) {
    return <span className={styles.dot} aria-hidden="true" data-testid={readAlongNoteTestIds.bullet} />;
  }
  return (
    <span className={styles.bullet} aria-hidden="true" data-testid={readAlongNoteTestIds.bullet}>
      {number}.
    </span>
  );
};

export const ReadAlongNote = ({
  lines,
  activeIndex,
  speaking,
  onSelectLine,
  captions = {},
  sectionSlot = null,
  renderRange,
  renderLineEnd,
  playingIndex = null,
  citedIndex = null,
}: ReadAlongNoteProps) => {
  const analytics = useOverviewPageAnalytics();
  const numbers = numberListLines(lines);
  const places = linePlaces(lines);
  const cited = useCitedOverviewPart();
  const follow = useFollowTheVoice(speaking);
  const root = useRef<HTMLDivElement | null>(null);

  // Shut steps stay in the page, hidden until found, so find-in-page still reaches every step.
  const stepIndexes = lines.flatMap((line, index) => (line.section === SOURCE_STEPS_SECTION && !line.heading ? [index] : []));
  const beyondFirst = stepIndexes.length > MOST_STEPS_SHOWN_WHOLE ? stepIndexes.slice(STEPS_SHOWN_FIRST) : [];
  const [stepsShown, setStepsShown] = useState(false);
  const citedBeyond = cited?.part === "step" && cited.index !== null && cited.index >= STEPS_SHOWN_FIRST;
  const reached =
    beyondFirst.includes(activeIndex) ||
    (playingIndex !== null && beyondFirst.includes(playingIndex)) ||
    (citedBeyond && beyondFirst.length > 0);
  const collapsed = new Set(stepsShown || reached ? [] : beyondFirst);
  const firstCollapsed = beyondFirst[0];
  const lastStepIndex = stepIndexes.at(-1);
  const lastStep = lastStepIndex === undefined ? undefined : lines[lastStepIndex];

  useLayoutEffect(() => {
    root.current?.querySelectorAll<HTMLElement>("[data-read-along-line]").forEach((element) => {
      if (element.dataset.collapsed === "true") {
        element.setAttribute("hidden", "until-found");
      } else {
        element.removeAttribute("hidden");
      }
    });
  });
  useEffect(() => {
    const element = root.current;
    const open = () => setStepsShown(true);
    element?.addEventListener("beforematch", open);
    return () => element?.removeEventListener("beforematch", open);
  }, []);

  useEffect(() => {
    if (citedIndex === null) {
      return;
    }
    root.current
      ?.querySelector<HTMLElement>(`[data-line-index="${citedIndex}"]`)
      ?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [citedIndex]);

  const showAllSteps = () => {
    analytics.sourceSteps.allShown({ steps: stepIndexes.length });
    setStepsShown(true);
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLElement>(`[data-line-index="${firstCollapsed}"] [data-testid="${readAlongNoteTestIds.lineText}"]`)
        ?.focus(),
    );
  };

  const hideSteps = () => {
    setStepsShown(false);
    requestAnimationFrame(() => {
      const showAll = root.current?.querySelector<HTMLElement>(`[data-testid="${readAlongNoteTestIds.showAllSteps}"]`);
      showAll?.focus({ preventScroll: true });
      showAll?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
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
        const part = SECTION_PART[line.section];
        return (
          <Fragment key={`${line.section}-${index}`}>
            <div
              ref={active ? follow.spokenLine : undefined}
              className={`${styles.line} ${line.heading ? styles.headingLine : styles.bodyLine} ${
                line.bullet ? styles.bulletLine : ""
              } ${line.heading && (slot || line.aside) ? styles.headingWithSlot : ""} ${active ? styles.lineActive : ""} ${
                step ? styles.stepLine : ""
              } ${playing ? styles.linePlaying : ""} ${index === citedIndex ? styles.lineCited : ""}`}
              onClick={() => select(index)}
              aria-current={playing ? "step" : undefined}
              data-read-along-line
              data-line-index={index}
              data-cited={index === citedIndex ? "true" : undefined}
              data-collapsed={collapsed.has(index) ? "true" : undefined}
              {...(part === undefined ? {} : citedPartProps(cited, part, places[index]!))}
              data-testid={active ? readAlongNoteTestIds.activeLine : readAlongNoteTestIds.line}
            >
              {line.bullet && <LineMarker step={step} hasSteps={stepIndexes.length > 0} number={numbers[index]} />}
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
            {index === lastStepIndex && stepsShown && !reached && beyondFirst.length > 0 && (
              <button
                type="button"
                className={styles.showAllSteps}
                aria-expanded="true"
                onClick={hideSteps}
                data-testid={readAlongNoteTestIds.hideSteps}
              >
                Hide steps
                <small>Back to the first {STEPS_SHOWN_FIRST}</small>
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

      {follow.offered && (
        <button type="button" className={styles.followButton} onClick={followTheVoice} data-testid={readAlongNoteTestIds.followButton}>
          <span className={styles.followButtonMark} aria-hidden="true" />
          Back to {sectionHeadingAt(lines, activeIndex)}
        </button>
      )}
    </div>
  );
};
