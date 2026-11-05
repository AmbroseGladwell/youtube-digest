import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { FIRST_NAME_MAX_LENGTH } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./NameEditor.module.scss";
import { nameEditorTestIds } from "./NameEditorTestIds.js";

export interface NameEditorProps {
  initialName: string | null;
  saving: boolean;
  refused: string | null;
  onSave: (firstName: string | null) => void;
  onCancel: () => void;
}

// Design 14b: opens with the field focused and the current name selected. Emptying it is
// how a name is removed, and the hint says so before saving; there is no separate Remove
// (docs/features/account-changes.md).
export function NameEditor({ initialName, saving, refused, onSave, onCancel }: NameEditorProps) {
  const ids = useId();
  const [name, setName] = useState(initialName ?? "");
  const [tooLong, setTooLong] = useState(false);
  const field = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  const problem = tooLong ? `Use ${FIRST_NAME_MAX_LENGTH} characters or fewer.` : refused;
  const trimmed = name.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed.length > FIRST_NAME_MAX_LENGTH) {
      setTooLong(true);
      field.current?.focus();
      return;
    }
    setTooLong(false);
    onSave(trimmed === "" ? null : trimmed);
  };

  return (
    <form className={styles.root} onSubmit={submit} noValidate data-testid={nameEditorTestIds.root}>
      <label className={styles.label}>
        <span className={styles.labelText}>First name</span>
        <span className={`${styles.field} ${problem !== null ? styles.fieldInvalid : ""}`}>
          <input
            ref={field}
            id={`${ids}-name`}
            name="given-name"
            className={styles.input}
            type="text"
            autoComplete="given-name"
            autoCapitalize="words"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setTooLong(false);
            }}
            aria-invalid={problem !== null}
            aria-describedby={problem === null ? `${ids}-hint` : `${ids}-error`}
            data-testid={nameEditorTestIds.input}
          />
        </span>
      </label>
      {problem === null ? (
        <p className={styles.hint} id={`${ids}-hint`} data-testid={nameEditorTestIds.hint}>
          {trimmed === ""
            ? "Saving it empty removes your name. Your email shows in its place."
            : "Shown in the account menu on every device you’re signed in on."}
        </p>
      ) : (
        <p className={styles.error} role="alert" id={`${ids}-error`} data-testid={nameEditorTestIds.error}>
          <StrokeIcon name="alertCircle" size={15} />
          <span>{problem}</span>
        </p>
      )}
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={saving} data-testid={nameEditorTestIds.saveButton}>
          Save name
        </button>
        <button type="button" className={styles.ghost} onClick={onCancel} data-testid={nameEditorTestIds.cancelButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}
