import { useId, useRef, useState, type FormEvent } from "react";
import { MAX_PROJECT_NAME_LENGTH, MAX_PROJECT_PURPOSE_LENGTH, sameTopicName } from "@overview/domain";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./NewProjectDialog.module.scss";
import { newProjectDialogTestIds } from "./NewProjectDialogTestIds.js";

export interface OnCreateOptions {
  name: string;
  purpose: string | null;
}

export interface NewProjectDialogProps {
  open: boolean;
  adds: { title: string } | { count: number } | null;
  assistantConnected: boolean;
  takenNames: string[];
  busy: boolean;
  onCreate: (input: OnCreateOptions) => void;
  onClose: () => void;
}

export const NewProjectDialog = ({ open, adds, assistantConnected, takenNames, busy, onCreate, onClose }: NewProjectDialogProps) => {
  const nameInput = useRef<HTMLInputElement | null>(null);
  const formId = useId();
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setName("");
      setPurpose("");
    }
  }
  const nameId = useId();
  const purposeId = useId();
  const helpId = useId();
  const takenId = useId();

  const trimmed = name.trim();
  const taken = takenNames.find((existing) => sameTopicName(existing, trimmed)) ?? null;
  const creatable = trimmed !== "" && taken === null && !busy;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!creatable) {
      return;
    }
    onCreate({ name: trimmed, purpose: purpose.trim() === "" ? null : purpose.trim() });
  };

  return (
    <BottomSheet
      open={open}
      title="New project"
      onClose={onClose}
      wide="dialog"
      width="28.75rem"
      initialFocus={nameInput}
      testId={newProjectDialogTestIds.root}
      foot={
        <>
          <button type="button" className={styles.quietAction} onClick={onClose} data-testid={newProjectDialogTestIds.cancelButton}>
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            className={styles.primaryAction}
            disabled={!creatable}
            data-testid={newProjectDialogTestIds.createButton}
          >
            Create project
          </button>
        </>
      }
    >
      <form id={formId} className={styles.content} onSubmit={submit}>
        {adds !== null && (
          <p className={styles.adds} data-testid={newProjectDialogTestIds.adds}>
            <StrokeIcon name="folder" size={14} />
            <span>{"title" in adds ? `Also adds “${adds.title}”` : `Also adds ${adds.count} overviews`}</span>
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
            ref={nameInput}
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
      </form>
    </BottomSheet>
  );
};
