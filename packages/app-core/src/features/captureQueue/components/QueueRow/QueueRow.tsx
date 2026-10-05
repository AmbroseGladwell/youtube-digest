import type { QueuedCapture } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./QueueRow.module.scss";
import { queueRowTestIds } from "./QueueRowTestIds.js";

export type QueueRowState = "making" | "next" | "waiting" | "noKey";

export interface QueueRowProps {
  capture: QueuedCapture;
  state: QueueRowState;
  position: number | null;
  step?: string;
  progress?: number;
  dense?: boolean;
  onRemove?: () => void;
}

const STATUS: Record<Exclude<QueueRowState, "making">, string> = {
  next: "Next",
  waiting: "Waiting",
  noKey: "Waiting for an API key",
};

// Design 27i–27j: a video that isn't an overview yet doesn't pretend to be one. No raised
// tile but the one being made, a faded thumbnail, no verdict or topic, and its status in
// words, so the difference never rests on colour.
export function QueueRow({ capture, state, position, step, progress = 0, dense = false, onRemove }: QueueRowProps) {
  const making = state === "making";
  return (
    <li
      className={`${styles.root} ${making ? styles.making : ""} ${dense ? styles.dense : ""}`}
      data-state={state}
      data-testid={queueRowTestIds.root}
    >
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
            <span data-testid={queueRowTestIds.status}>{STATUS[state]}</span>
          )}
          <span aria-hidden="true">·</span>
          <span>From {capture.fromPlaylist.title}</span>
        </span>
      </span>
      {onRemove !== undefined && (
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
