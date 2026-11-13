import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { MAX_PROJECT_NAME_LENGTH, MAX_PROJECT_PURPOSE_LENGTH, sameTopicName } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./NewProjectDialog.module.scss";
import { newProjectDialogTestIds } from "./NewProjectDialogTestIds.js";

export interface NewProjectDialogProps {
  // The overview made from the picker, which the new project takes with it (168x).
  adds: string | null;
  // Whether the reader has an assistant connected, which the helper line mentions only then.
  assistantConnected: boolean;
  takenNames: string[];
  busy: boolean;
  onCreate: (input: { name: string; purpose: string | null }) => void;
  onClose: () => void;
}

// A name, and what it's for with the reason to write it right under the field
// ("OV-168 3 Adding and Making" 168x, 168y, 168y-2).
export function NewProjectDialog({ adds, assistantConnected, takenNames, busy, onCreate, onClose }: NewProjectDialogProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const headingId = useId();
  const nameId = useId();
  const purposeId = useId();
  const helpId = useId();
  const takenId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const trimmed = name.trim();
  const taken = takenNames.find((existing) => sameTopicName(existing, trimmed)) ?? null;
  const creatable = trimmed !== "" && taken === null && !busy;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!creatable) return;
    onCreate({ name: trimmed, purpose: purpose.trim() === "" ? null : purpose.trim() });
  };

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      data-testid={newProjectDialogTestIds.root}
    >
      <form className={styles.panel} onSubmit={submit}>
        <span className={styles.handle} aria-hidden="true" />
        <h2 className={styles.heading} id={headingId}>
          New project
        </h2>
        {adds !== null && (
          <p className={styles.adds} data-testid={newProjectDialogTestIds.adds}>
            <StrokeIcon name="folder" size={14} />
            <span>Also adds “{adds}”</span>
          </p>
        )}
        <div className={styles.field}>
          <label className={styles.label} htmlFor={nameId}>
            Name
            <span className={styles.count} data-testid={newProjectDialogTestIds.nameCount}>
              {name.length} / {MAX_PROJECT_NAME_LENGTH}
            </span>
          </label>
          <input
            id={nameId}
            name="project-name"
            autoComplete="off"
            autoFocus
            className={styles.input}
            maxLength={MAX_PROJECT_NAME_LENGTH}
            placeholder="Kitchen renovation"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-describedby={taken === null ? undefined : takenId}
            aria-invalid={taken !== null}
            data-testid={newProjectDialogTestIds.nameInput}
          />
          {taken !== null && (
            <p className={styles.taken} id={takenId} data-testid={newProjectDialogTestIds.taken}>
              You already have a project called “{taken}”.
            </p>
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={purposeId}>
            What it’s for
            <span className={styles.optional}>Optional</span>
          </label>
          <textarea
            id={purposeId}
            name="project-purpose"
            className={styles.textarea}
            maxLength={MAX_PROJECT_PURPOSE_LENGTH}
            rows={3}
            placeholder="Redo the kitchen by March for £18k, without moving the sink"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            aria-describedby={helpId}
            data-testid={newProjectDialogTestIds.purposeInput}
          />
          <p className={styles.help} id={helpId}>
            <span data-testid={newProjectDialogTestIds.purposeHelp}>
              {assistantConnected ? "Your assistant works from this. " : ""}Say what you’re doing, by when, and what matters most.
            </span>
            <span className={styles.count} data-testid={newProjectDialogTestIds.purposeCount}>
              {purpose.length} / {MAX_PROJECT_PURPOSE_LENGTH}
            </span>
          </p>
        </div>
        <div className={styles.foot}>
          <button type="button" className={styles.quietAction} onClick={onClose} data-testid={newProjectDialogTestIds.cancelButton}>
            Cancel
          </button>
          <button type="submit" className={styles.primaryAction} disabled={!creatable} data-testid={newProjectDialogTestIds.createButton}>
            Create project
          </button>
        </div>
      </form>
    </dialog>
  );
}
