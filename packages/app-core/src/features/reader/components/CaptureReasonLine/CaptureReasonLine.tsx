import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Overview } from "@overview/domain";
import { useSetOverviewCaptureReasonMutation } from "../../../overviews/mutations/useSetOverviewCaptureReasonMutation.js";
import { captureReasonFromDraft } from "../../../overviews/util/captureReasonFromDraft.js";
import styles from "./CaptureReasonLine.module.scss";
import { captureReasonLineTestIds } from "./CaptureReasonLineTestIds.js";

export interface CaptureReasonLineProps {
  overview: Overview;
  editing: boolean;
  compact: boolean;
  onEditingChange: (editing: boolean) => void;
}

// Design 20c and 21b: the reason reads back as one line above the premise, the reminder it
// was in the prototype, and only when there is one. 21d: editing turns the same line into
// the field, with Enter to save and Escape to cancel (docs/features/capture-reason.md).
export function CaptureReasonLine({ overview, editing, compact, onEditingChange }: CaptureReasonLineProps) {
  const setCaptureReason = useSetOverviewCaptureReasonMutation();
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement | null>(null);

  // The draft is taken as editing opens and not again: a write landing mid-edit must not
  // overwrite what is being typed.
  useEffect(() => {
    if (editing) {
      setDraft(overview.captureReason ?? "");
      input.current?.focus();
    }
  }, [editing]);

  const close = () => onEditingChange(false);

  const save = (captureReason: string | null) => {
    if (captureReason !== overview.captureReason) {
      setCaptureReason.mutate({ overview, captureReason });
    }
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save(captureReasonFromDraft(draft));
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  if (editing) {
    return (
      <label
        className={`${styles.root} ${compact ? styles.rootCompact : ""}`}
        data-testid={captureReasonLineTestIds.editor}
      >
        <span className={styles.label}>What are you hoping to take away?</span>
        <input
          ref={input}
          type="text"
          className={styles.input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          data-testid={captureReasonLineTestIds.input}
        />
        <span className={styles.actions}>
          <button
            type="button"
            className={styles.save}
            onClick={() => save(captureReasonFromDraft(draft))}
            data-testid={captureReasonLineTestIds.saveButton}
          >
            Save
          </button>
          <button
            type="button"
            className={styles.cancel}
            onClick={close}
            data-testid={captureReasonLineTestIds.cancelButton}
          >
            Cancel
          </button>
          {overview.captureReason !== null && (
            <button
              type="button"
              className={styles.remove}
              onClick={() => save(null)}
              data-testid={captureReasonLineTestIds.removeButton}
            >
              {compact ? "Remove" : "Remove reason"}
            </button>
          )}
        </span>
      </label>
    );
  }

  if (overview.captureReason === null) {
    return null;
  }

  return (
    <div
      className={`${styles.root} ${compact ? styles.rootCompact : ""}`}
      data-testid={captureReasonLineTestIds.root}
    >
      <span className={styles.label}>You wanted to know</span>
      <span className={styles.reason} data-testid={captureReasonLineTestIds.reason}>
        {overview.captureReason}
      </span>
    </div>
  );
}
