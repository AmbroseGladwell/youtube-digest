import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { StrokeIcon } from "../StrokeIcon/StrokeIcon.js";
import styles from "./ChecklistPicker.module.scss";

export type ChecklistState = "all" | "some" | "none";

export interface ChecklistOption {
  id: string;
  name: string;
  detail?: string | null;
  count: number;
  state: ChecklistState;
}

export interface ChecklistPickerTestIds {
  root: string;
  findInput: string;
  option: (name: string) => string;
  newProjectButton: string;
  foot: string;
  doneButton: string;
}

interface Naming {
  placeholder: string;
  refusal: (name: string) => string | null;
  onCreate: (name: string) => void;
}

export interface ChecklistPickerProps {
  heading: string;
  hint: string;
  groupLabel: string;
  findPlaceholder: string;
  options: ChecklistOption[];
  // Ticking an option nobody or only some have gives it to all; unticking one all have takes it
  // from all.
  onToggle: (id: string, give: boolean) => void;
  newLabel: string;
  // Either opens a dialog of its own, or names the new one in place.
  onNew: (() => void) | Naming;
  foot: string;
  onClose: () => void;
  testIds: ChecklistPickerTestIds;
}

const FIND_ABOVE = 8;

// A dialog on the web and a sheet on a phone. Each tick saves as it's made, and Done only
// closes ("OV-168 3 Adding and Making" 168t, 168u; "OV-168 5" 168as).
export function ChecklistPicker({
  heading,
  hint,
  groupLabel,
  findPlaceholder,
  options,
  onToggle,
  newLabel,
  onNew,
  foot,
  onClose,
  testIds,
}: ChecklistPickerProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [query, setQuery] = useState("");
  const [naming, setNaming] = useState<string | null>(null);
  const headingId = useId();
  const findId = useId();
  const nameId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
    }
  }, []);

  const needle = query.trim().toLocaleLowerCase();
  const shown = needle === "" ? options : options.filter(({ name }) => name.toLocaleLowerCase().includes(needle));
  const refusal = naming === null || typeof onNew === "function" ? null : onNew.refusal(naming);

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (naming === null || typeof onNew === "function" || naming.trim() === "" || refusal !== null) return;
    onNew.onCreate(naming.trim());
    setNaming(null);
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
      data-testid={testIds.root}
    >
      <div className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />
        <h2 className={styles.heading} id={headingId}>
          {heading}
        </h2>
        <p className={styles.hint}>{hint}</p>
        {options.length > FIND_ABOVE && (
          <label className={styles.find} htmlFor={findId}>
            <StrokeIcon name="search" size={14} />
            <input
              id={findId}
              name="checklist-find"
              type="search"
              autoComplete="off"
              className={styles.findInput}
              placeholder={findPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              data-testid={testIds.findInput}
            />
          </label>
        )}
        <div className={styles.list} role="group" aria-label={groupLabel}>
          {shown.map((option) => (
            <label key={option.id} className={styles.option} data-state={option.state} data-testid={testIds.option(option.name)}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={option.state === "all"}
                ref={(element) => {
                  if (element) element.indeterminate = option.state === "some";
                }}
                onChange={() => onToggle(option.id, option.state !== "all")}
              />
              <span className={styles.box} aria-hidden="true">
                {option.state === "all" && <StrokeIcon name="check" size={13} />}
                {option.state === "some" && <StrokeIcon name="minus" size={13} />}
              </span>
              <span className={styles.name}>
                {option.name}
                {option.detail && <span className={styles.madeBy}>{option.detail}</span>}
              </span>
              <span className={styles.count}>{option.count}</span>
            </label>
          ))}
          {naming === null ? (
            <button
              type="button"
              className={`${styles.option} ${styles.newProject}`}
              onClick={() => (typeof onNew === "function" ? onNew() : setNaming(""))}
              data-testid={testIds.newProjectButton}
            >
              <span className={styles.plus} aria-hidden="true">
                <StrokeIcon name="plus" size={14} />
              </span>
              <span className={styles.name}>{newLabel}</span>
            </button>
          ) : (
            typeof onNew !== "function" && (
              <form className={styles.naming} onSubmit={create}>
                <input
                  id={nameId}
                  name="checklist-new"
                  autoComplete="off"
                  ref={(element) => element?.focus()}
                  className={styles.namingInput}
                  placeholder={onNew.placeholder}
                  aria-label={onNew.placeholder}
                  aria-invalid={refusal !== null}
                  aria-describedby={refusal === null ? undefined : `${nameId}-refusal`}
                  value={naming}
                  onChange={(event) => setNaming(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      setNaming(null);
                    }
                  }}
                />
                <button type="submit" className={styles.namingAdd} disabled={naming.trim() === "" || refusal !== null}>
                  Add
                </button>
                {refusal !== null && (
                  <p className={styles.refusal} id={`${nameId}-refusal`}>
                    {refusal}
                  </p>
                )}
              </form>
            )
          )}
        </div>
        <div className={styles.foot}>
          <span aria-live="polite" data-testid={testIds.foot}>
            {foot}
          </span>
          <button type="button" className={styles.done} onClick={onClose} data-testid={testIds.doneButton}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
