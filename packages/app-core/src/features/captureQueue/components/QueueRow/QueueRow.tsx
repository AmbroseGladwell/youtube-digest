import type { QueuedCapture } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./QueueRow.module.scss";
import { queueRowTestIds } from "./QueueRowTestIds.js";

export type QueueRowState =
  | "making"
  | "next"
  | "waiting"
  | "chosenNext"
  | "chosen"
  | "noKey"
  | "held"
  | "monthSpent"
  | "tomorrow"
  | "forYou";

export interface QueueRowProps {
  capture: QueuedCapture;
  state: QueueRowState;
  position: number | null;
  step?: string;
  progress?: number;
  resumeTime?: string | undefined;
  dense?: boolean;
  // A row grouped under its playlist doesn't name the playlist again.
  showFrom?: boolean;
  onRemove?: () => void;
  onMakeNow?: () => void;
  // While choosing several, a checkbox replaces the row's actions.
  choice?: { checked: boolean; onToggle: () => void };
}

const STATUS: Record<Exclude<QueueRowState, "making" | "held" | "monthSpent">, string> = {
  next: "Next",
  waiting: "Waiting",
  chosenNext: "Next · you chose it",
  chosen: "You chose it",
  noKey: "Waiting for an API key",
  tomorrow: "Continues tomorrow",
  forYou: "Waiting for you",
};

const statusText = (state: Exclude<QueueRowState, "making">, resumeTime: string | undefined) => {
  if (state === "held") {
    return `Continues after ${resumeTime ?? "the limit resets"}`;
  }
  if (state === "monthSpent") {
    return `Waiting for ${resumeTime ?? "next month"}`;
  }
  return STATUS[state];
};

export const QueueRow = ({
  capture,
  state,
  position,
  step,
  progress = 0,
  resumeTime,
  dense = false,
  showFrom = true,
  onRemove,
  onMakeNow,
  choice,
}: QueueRowProps) => {
  const making = state === "making";
  const chosenByReader = state === "chosenNext" || state === "chosen";
  return (
    <li
      className={`${styles.root} ${making ? styles.making : ""} ${dense ? styles.dense : ""} ${choice?.checked ? styles.checked : ""} ${choice === undefined ? "" : styles.choosing}`}
      data-state={state}
      data-testid={queueRowTestIds.root}
    >
      {choice !== undefined && (
        <button
          type="button"
          role="checkbox"
          aria-checked={choice.checked}
          aria-label={`Choose “${capture.title}”`}
          className={styles.checkbox}
          onClick={choice.onToggle}
          data-testid={queueRowTestIds.checkbox}
        >
          <span className={styles.box} aria-hidden="true">
            {choice.checked && <StrokeIcon name="check" size={14} />}
          </span>
        </button>
      )}
      {position !== null && (
        <span className={styles.position} aria-hidden="true">
          {position}
        </span>
      )}
      <span className={`${styles.thumb} ${making ? "" : styles.thumbFaded}`} aria-hidden="true">
        {capture.thumbnailUrl === null ? (
          <StrokeIcon name="play" size={dense ? 13 : 16} />
        ) : (
          <img src={capture.thumbnailUrl} alt="" loading="lazy" />
        )}
      </span>
      <span className={styles.text}>
        <span className={styles.title} data-testid={queueRowTestIds.title}>
          {capture.title}
        </span>
        <span className={styles.meta}>
          {making ? (
            <span className={styles.makingNow} data-testid={queueRowTestIds.status}>
              <span className={styles.dot} aria-hidden="true" />
              Making now{step === undefined ? "" : ` · ${step}`}
            </span>
          ) : (
            <span className={chosenByReader ? styles.chosenStatus : undefined} data-testid={queueRowTestIds.status}>
              {statusText(state, resumeTime)}
            </span>
          )}
          {showFrom && (
            <>
              <span aria-hidden="true">·</span>
              <span>From {capture.fromPlaylist.title}</span>
            </>
          )}
        </span>
      </span>
      {choice === undefined && onMakeNow !== undefined && (
        <button
          type="button"
          className={styles.makeNow}
          onClick={onMakeNow}
          aria-label={`Make “${capture.title}” now`}
          data-testid={queueRowTestIds.makeNowButton}
        >
          {!dense && <StrokeIcon name="zap" size={13} />}
          Make now
        </button>
      )}
      {choice === undefined && onRemove !== undefined && (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={`Remove “${capture.title}” from the queue`}
          data-testid={queueRowTestIds.removeButton}
        >
          <StrokeIcon name="close" size={16} />
        </button>
      )}
      {making && (
        <span className={styles.barTrack} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${progress}%` }} />
        </span>
      )}
    </li>
  );
};
