import { useEffect, useRef } from "react";
import { MILESTONES, spokenTimeSaved, type TimeSavedSummary } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { milestoneColourStyle } from "../../util/milestoneColourStyle.js";
import { TimeSavedFigure } from "../TimeSavedFigure/TimeSavedFigure.js";
import styles from "./TimeSavedSheet.module.scss";
import { timeSavedSheetTestIds } from "./TimeSavedSheetTestIds.js";

export interface TimeSavedSheetProps {
  open: boolean;
  summary: TimeSavedSummary;
  onClose: () => void;
}

const HEADING_ID = "TimeSavedSheet-heading";

const overviews = (count: number) => `${count} ${count === 1 ? "overview" : "overviews"}`;

// Design 34ai: the figure, how it is counted, the way to the next milestone, the ones
// already reached, and what was left out. A centred card on a desktop and a bottom sheet
// on a phone, like the other dialogs (docs/features/time-saved.md, "Counted honestly").
export function TimeSavedSheet({ open, summary, onClose }: TimeSavedSheetProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const { minutes } = summary;
  const reached = MILESTONES.filter((milestone) => milestone.minutes <= minutes);
  const next = MILESTONES.find((milestone) => milestone.minutes > minutes);
  const from = reached.at(-1)?.minutes ?? 0;
  const leftOut = summary.withoutLength + summary.watchVerdict + summary.lessPartToWatch;

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    }
    if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={HEADING_ID}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          onClose();
        }
      }}
      data-testid={timeSavedSheetTestIds.root}
    >
      <div className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.head}>
          <div className={styles.headText}>
            <h2 id={HEADING_ID} className={styles.label}>
              Time saved
            </h2>
            <p className={styles.figure} aria-label={spokenTimeSaved(minutes)} data-testid={timeSavedSheetTestIds.figure}>
              {open && <TimeSavedFigure minutes={minutes} />}
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
            data-testid={timeSavedSheetTestIds.closeButton}
          >
            <StrokeIcon name="close" size={16} />
          </button>
        </div>

        <p className={styles.how} data-testid={timeSavedSheetTestIds.how}>
          {summary.counted === 0
            ? "Nothing counted yet. Mark an overview read and what it saved you shows here."
            : `From ${overviews(summary.counted)} you’ve read: each video’s length, minus the time the overview took to read.`}
        </p>

        {next !== undefined && (
          <div className={styles.next} style={milestoneColourStyle(next.id)} data-testid={timeSavedSheetTestIds.next}>
            <div className={styles.nextHead}>
              <p className={styles.label}>
                Next: <span className={styles.nextName}>{next.label}</span>
              </p>
              <p className={styles.toGo}>{next.minutes - minutes} min to go</p>
            </div>
            <div
              className={styles.track}
              role="progressbar"
              aria-label={`Progress to ${next.label}`}
              aria-valuemin={from}
              aria-valuemax={next.minutes}
              aria-valuenow={minutes}
            >
              <div className={styles.bar} style={{ width: `${((minutes - from) / (next.minutes - from)) * 100}%` }} />
            </div>
          </div>
        )}

        {reached.length > 0 && (
          <div className={styles.group}>
            <p className={styles.label}>Reached</p>
            <ul className={styles.reached} data-testid={timeSavedSheetTestIds.reached}>
              {reached.map((milestone) => (
                <li key={milestone.id} className={styles.reachedChip} style={milestoneColourStyle(milestone.id)}>
                  {milestone.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {leftOut > 0 && (
          <div className={styles.leftOut} data-testid={timeSavedSheetTestIds.notCounted}>
            <p className={styles.label}>Not counted</p>
            {summary.withoutLength > 0 && (
              <p className={styles.leftOutLine}>{overviews(summary.withoutLength)} without a video length</p>
            )}
            {summary.watchVerdict > 0 && (
              <p className={styles.leftOutLine}>{summary.watchVerdict} the verdict said to watch</p>
            )}
            {summary.lessPartToWatch > 0 && (
              <p className={styles.leftOutAside}>
                {summary.lessPartToWatch} the verdict said to watch in part {summary.lessPartToWatch === 1 ? "counts" : "count"}{" "}
                without that part.
              </p>
            )}
          </div>
        )}

        <p className={styles.caveat}>Counted at normal speed. If you’d have watched faster, you saved less.</p>
      </div>
    </dialog>
  );
}
