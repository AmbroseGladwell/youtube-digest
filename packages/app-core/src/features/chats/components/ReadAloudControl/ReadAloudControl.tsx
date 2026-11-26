import { useEffect, useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useReadAloud, useReadAloudSnapshot } from "../../readAloud/ReadAloudContext.js";
import { sameAnswer, type AnswerRef, type ReadAloudControl as Control, type ReadAloudMeta } from "../../readAloud/ReadAloudEngine.js";
import styles from "./ReadAloudControl.module.scss";
import { readAloudControlTestIds } from "./ReadAloudControlTestIds.js";

const SPINNER_AFTER_MS = 400;

export type ReadAloudAbout = Omit<ReadAloudMeta, "control">;

export interface ReadAloudControlProps {
  answer: AnswerRef;
  about: ReadAloudAbout;
  control: Control;
}

const nameOf = (status: string): string => {
  if (status === "starting") {
    return "Starting to read. Press to cancel";
  }
  if (status === "playing") {
    return "Pause reading";
  }
  return status === "paused" ? "Resume reading" : "Read response aloud";
};

// One control in two places, top and bottom (design 418a to 418g).
export const ReadAloudControl = ({ answer, about, control }: ReadAloudControlProps) => {
  const engine = useReadAloud();
  const snapshot = useReadAloudSnapshot();
  const status = snapshot !== null && sameAnswer(snapshot.answer, answer) ? snapshot.status : "idle";
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (status !== "starting") {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SPINNER_AFTER_MS);
    return () => clearTimeout(timer);
  }, [status]);

  if (engine === null || snapshot === null || snapshot.voiceless) {
    return null;
  }
  const pressed = status === "starting" || status === "playing";
  return (
    <span className={styles.root}>
      <button
        type="button"
        className={`${styles.button} ${status === "idle" ? "" : styles.on}`}
        aria-label={nameOf(status)}
        aria-pressed={pressed}
        title={status === "idle" ? "Read aloud" : undefined}
        onPointerEnter={() => engine.warm()}
        onFocus={() => engine.warm()}
        onClick={() => engine.press(answer, { ...about, control })}
        data-testid={readAloudControlTestIds.play}
        data-control={control}
        data-status={status}
      >
        {status === "starting" && slow ? (
          <span className={styles.spinner} aria-hidden="true" data-testid={readAloudControlTestIds.spinner} />
        ) : (
          <StrokeIcon name={status === "playing" ? "pause" : "play"} size={14} />
        )}
      </button>
      {status === "paused" && (
        <button
          type="button"
          className={styles.button}
          aria-label="Start again from the beginning"
          title="Start again"
          onClick={() => engine.startAgain()}
          data-testid={readAloudControlTestIds.again}
        >
          <StrokeIcon name="rotateCcw" size={14} />
        </button>
      )}
    </span>
  );
};
