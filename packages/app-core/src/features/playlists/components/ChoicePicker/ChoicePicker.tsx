import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import styles from "./ChoicePicker.module.scss";
import { choicePickerTestIds } from "./ChoicePickerTestIds.js";

export interface ChoicePickerProps<Choice extends string> {
  choice: Choice;
  choices: readonly Choice[];
  labelOf: (choice: Choice) => string;
  // Also names the test ids and the radio group: "pace", "order".
  name: string;
  title: string;
  subject: string;
  icon: StrokeIconName;
  // Absent, the options are names alone.
  optionDetail?: (choice: Choice) => string;
  asSheet: boolean;
  sheetLine?: string;
  sheetFoot: string;
  stacked: boolean;
  onChange: (choice: Choice) => void;
}

// Choosing saves straight away; there is nothing to confirm (95x–95z).
export const ChoicePicker = <Choice extends string>({
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
}: ChoicePickerProps<Choice>) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const sheetHeading = useId();
  const label = `${title} for ${subject}`;

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useDismissOnOutside(open && !asSheet, close, root);

  useEffect(() => {
    if (open && !asSheet) {
      options.current[choices.indexOf(choice)]?.focus();
    }
  }, [open, asSheet, choice, choices]);

  const choose = (next: Choice) => {
    if (next !== choice) {
      onChange(next);
    }
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
        <BottomSheet
          open={open}
          title={title}
          onClose={close}
          returnFocusTo={trigger.current}
          testId={choicePickerTestIds.sheet(name)}
          foot={
            <button type="button" className={styles.done} onClick={close} data-testid={choicePickerTestIds.doneButton(name)}>
              Done
            </button>
          }
        >
          {sheetLine !== undefined && <p className={styles.sheetLine}>{sheetLine}</p>}
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
        </BottomSheet>
      )}
    </div>
  );
};
