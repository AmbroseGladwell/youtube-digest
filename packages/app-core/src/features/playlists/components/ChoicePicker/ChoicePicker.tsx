import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import styles from "./ChoicePicker.module.scss";
import { choicePickerTestIds } from "./ChoicePickerTestIds.js";

export interface ChoicePickerProps<Choice extends string> {
  choice: Choice;
  choices: readonly Choice[];
  labelOf: (choice: Choice) => string;
  // What is being chosen, for the test ids and the radio group's name: "pace", "order".
  name: string;
  // The two halves of the control's label: "Pace" for "Psychology".
  title: string;
  subject: string;
  icon: StrokeIconName;
  // What each option would do, written out under it. Absent, the options are names alone.
  optionDetail?: (choice: Choice) => string;
  // On a phone the choice is a sheet of radios rather than a menu (95z).
  asSheet: boolean;
  sheetLine?: string;
  sheetFoot: string;
  stacked: boolean;
  onChange: (choice: Choice) => void;
}

// Design 95x–95z: a pill naming the choice, which opens the options with what each would do.
// Choosing saves straight away; there is nothing to confirm. Built for a playlist's pace, and
// used for its order too (docs/features/playlists.md, "An order for each playlist").
export function ChoicePicker<Choice extends string>({
  choice,
  choices,
  labelOf,
  name,
  title,
  subject,
  icon,
  optionDetail,
  asSheet,
  sheetLine,
  sheetFoot,
  stacked,
  onChange,
}: ChoicePickerProps<Choice>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const sheet = useRef<HTMLDialogElement | null>(null);
  const sheetHeading = useId();
  const label = `${title} for ${subject}`;

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useDismissOnOutside(open && !asSheet, close, root);

  useEffect(() => {
    if (open && !asSheet) options.current[choices.indexOf(choice)]?.focus();
  }, [open, asSheet, choice, choices]);

  useEffect(() => {
    const element = sheet.current;
    if (element === null) return;
    if (open && asSheet && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open, asSheet]);

  const choose = (next: Choice) => {
    if (next !== choice) onChange(next);
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = options.current.indexOf(document.activeElement as HTMLButtonElement);
    const last = choices.length - 1;
    const target = {
      ArrowDown: current === last ? 0 : current + 1,
      ArrowUp: current <= 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (target !== undefined) {
      event.preventDefault();
      options.current[target]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className={styles.root} ref={root}>
      <button
        type="button"
        ref={trigger}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""} ${stacked ? styles.triggerStacked : ""}`}
        onClick={() => setOpen(!open)}
        aria-label={`${label}: ${labelOf(choice)}`}
        aria-haspopup={asSheet ? "dialog" : "menu"}
        aria-expanded={open}
        data-testid={choicePickerTestIds.trigger(name)}
      >
        <StrokeIcon name={icon} size={14} />
        {labelOf(choice)}
        <StrokeIcon name="chevronDown" size={14} />
      </button>

      {open && !asSheet && (
        <div className={styles.menu} role="menu" aria-label={label} onKeyDown={moveFocus} data-testid={choicePickerTestIds.menu(name)}>
          {choices.map((option, index) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === choice}
              tabIndex={-1}
              ref={(element) => {
                options.current[index] = element;
              }}
              className={styles.item}
              onClick={() => {
                close();
                choose(option);
              }}
              data-testid={choicePickerTestIds.option(name, option)}
            >
              <span className={styles.check} aria-hidden="true">
                {option === choice && <StrokeIcon name="check" size={16} />}
              </span>
              <span className={styles.itemText}>
                <span className={styles.itemName}>{labelOf(option)}</span>
                {optionDetail !== undefined && <span className={styles.itemDetail}>{optionDetail(option)}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {asSheet && (
        <dialog
          ref={sheet}
          className={styles.sheet}
          aria-labelledby={sheetHeading}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClick={(event) => {
            if (event.target === sheet.current) close();
          }}
          data-testid={choicePickerTestIds.sheet(name)}
        >
          <div className={styles.sheetPanel}>
            <span className={styles.handle} aria-hidden="true" />
            <div className={styles.sheetHead}>
              <h2 className={styles.sheetTitle} id={sheetHeading}>
                {title}
              </h2>
              {sheetLine !== undefined && <p className={styles.sheetLine}>{sheetLine}</p>}
            </div>
            <div className={styles.radios} role="radiogroup" aria-label={label}>
              {choices.map((option) => (
                <label key={option} className={styles.radioOption} data-testid={choicePickerTestIds.option(name, option)}>
                  <input
                    type="radio"
                    name={`${name}-${sheetHeading}`}
                    className={styles.radio}
                    value={option}
                    checked={option === choice}
                    onChange={() => choose(option)}
                  />
                  <span className={styles.itemText}>
                    <span className={styles.itemName}>{labelOf(option)}</span>
                    {optionDetail !== undefined && <span className={styles.itemDetail}>{optionDetail(option)}</span>}
                  </span>
                </label>
              ))}
            </div>
            <p className={styles.sheetFoot}>{sheetFoot}</p>
            <button type="button" className={styles.done} onClick={close} data-testid={choicePickerTestIds.doneButton(name)}>
              Done
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
