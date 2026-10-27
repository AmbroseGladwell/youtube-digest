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
  | "trialSpent"
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
  // When a held video continues, written out (docs/features/capture-queue.md, "Waiting at a limit").
  resumeTime?: string | undefined;
  dense?: boolean;
  // A row grouped under its playlist doesn't name the playlist again.
  showFrom?: boolean;
  onRemove?: () => void;
  // Made next, past its playlist's pace (95af).
  onMakeNow?: () => void;
  // Choosing several: the row's actions give way to a checkbox (95ag).
  choice?: { checked: boolean; onToggle: () => void };
}

const STATUS: Record<Exclude<QueueRowState, "making" | "held" | "monthSpent">, string> = {
  next: "Next",
  waiting: "Waiting",
  chosenNext: "Next · you chose it",
  chosen: "You chose it",
  noKey: "Waiting for an API key",
  trialSpent: "Waiting for an account",
  tomorrow: "Continues tomorrow",
  forYou: "Waiting for you",
};

const statusText = (state: Exclude<QueueRowState, "making">, resumeTime: string | undefined) =>
  state === "held"
    ? `Continues after ${resumeTime ?? "the limit resets"}`
    : state === "monthSpent"
      ? `Waiting for ${resumeTime ?? "next month"}`
      : STATUS[state];

// Design 27i–27j: a video that isn't an overview yet doesn't pretend to be one. No raised
// tile but the one being made, a faded thumbnail, no verdict or topic, and its status in
// words, so the difference never rests on colour. A video waiting on its pace is waiting,
// not failed: muted, never warning ink (95aa).
export function QueueRow({
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
}: QueueRowProps) {
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
        {capture.thumbnailUrl === null ? <StrokeIcon name="play" size={dense ? 13 : 16} /> : <img src={capture.thumbnailUrl} alt="" loading="lazy" />}
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
}
