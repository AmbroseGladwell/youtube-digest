import type { KeyboardEvent } from "react";
import styles from "./CaptureReasonField.module.scss";
import { captureReasonFieldTestIds } from "./CaptureReasonFieldTestIds.js";

export interface CaptureReasonFieldProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}

// Design 20a and 21a: an underline field under the steps, not a box, so it reads as a
// margin note written while the overview is being made. It saves on blur or when the
// overview lands; there is nothing to confirm (docs/features/capture-reason.md).
export function CaptureReasonField({ value, onChange, onCommit }: CaptureReasonFieldProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  };

  return (
    <label className={styles.root} data-testid={captureReasonFieldTestIds.root}>
      <span className={styles.label}>
        What are you hoping to take away? <em className={styles.optional}>Optional</em>
      </span>
      <input
        type="text"
        className={styles.input}
        placeholder="e.g. Does the capacity argument hold for the UK?"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        onKeyDown={onKeyDown}
        data-testid={captureReasonFieldTestIds.input}
      />
    </label>
  );
}
