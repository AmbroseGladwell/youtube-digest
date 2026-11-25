import { MILESTONES, spokenTimeSaved, type TimeSavedSummary } from "@overview/domain";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { milestoneColourStyle } from "../../util/milestoneColourStyle.js";
import { TimeSavedFigure } from "../TimeSavedFigure/TimeSavedFigure.js";
import styles from "./TimeSavedSheet.module.scss";
import { timeSavedSheetTestIds } from "./TimeSavedSheetTestIds.js";

export interface TimeSavedSheetProps {
  open: boolean;
  summary: TimeSavedSummary;
  onClose: () => void;
}

const overviews = (count: number) => `${count} ${count === 1 ? "overview" : "overviews"}`;

export const TimeSavedSheet = ({ open, summary, onClose }: TimeSavedSheetProps) => {
  const { minutes } = summary;
  const reached = MILESTONES.filter((milestone) => milestone.minutes <= minutes);
  const next = MILESTONES.find((milestone) => milestone.minutes > minutes);
  const from = reached.at(-1)?.minutes ?? 0;
  const leftOut = summary.withoutLength + summary.watchVerdict + summary.lessPartToWatch + summary.recipe;

  return (
    <BottomSheet
      open={open}
      title="Time saved"
      onClose={onClose}
      wide="dialog"
      width="26rem"
      testId={timeSavedSheetTestIds.root}
      head={
        <div className={styles.headText}>
          <p className={styles.label}>Time saved</p>
          <p className={styles.figure} aria-label={spokenTimeSaved(minutes)} data-testid={timeSavedSheetTestIds.figure}>
            <TimeSavedFigure minutes={minutes} />
          </p>
        </div>
      }
    >
      <div className={styles.content}>
        <p className={styles.how} data-testid={timeSavedSheetTestIds.how}>
          {summary.counted === 0
            ? "Nothing counted yet. Mark an overview read and what it saved you shows here."
            : `From ${overviews(summary.counted)} you’ve read: each video’s length or article’s reading time, minus the time the overview took to read.`}
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
            {summary.withoutLength > 0 && <p className={styles.leftOutLine}>{overviews(summary.withoutLength)} without a video length</p>}
            {summary.watchVerdict > 0 && <p className={styles.leftOutLine}>{summary.watchVerdict} the verdict said to watch or read</p>}
            {summary.recipe > 0 && (
              <p className={styles.leftOutLine}>
                {summary.recipe} {summary.recipe === 1 ? "recipe" : "recipes"}, since you’d cook {summary.recipe === 1 ? "it" : "them"}{" "}
                rather than read {summary.recipe === 1 ? "it" : "them"}
              </p>
            )}
            {summary.lessPartToWatch > 0 && (
              <p className={styles.leftOutAside}>
                {summary.lessPartToWatch} the verdict said to watch or read in part {summary.lessPartToWatch === 1 ? "counts" : "count"}{" "}
                without that part.
              </p>
            )}
          </div>
        )}

        <p className={styles.caveat}>Counted at normal speed. If you’d have watched faster, you saved less.</p>
      </div>
    </BottomSheet>
  );
};
