import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { PLAYLIST_PACES, type PlaylistPace } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { PACE_LABEL } from "../../util/paceCopy.js";
import styles from "./PacePicker.module.scss";
import { pacePickerTestIds } from "./PacePickerTestIds.js";

export interface PacePickerProps {
  pace: PlaylistPace;
  // What the control is the pace of, for its label: "Pace for Psychology".
  subject: string;
  // What each option would do, written out under it. Absent, the options are names alone.
  optionDetail?: (pace: PlaylistPace) => string;
  // On a phone the choice is a sheet of radios rather than a menu (95z).
  asSheet: boolean;
  sheetLine?: string;
  stacked: boolean;
  onChange: (pace: PlaylistPace) => void;
}

// Design 95x–95z: a pill naming the pace, which opens the paces with what each would do.
// Choosing saves straight away; there is nothing to confirm.
export function PacePicker({ pace, subject, optionDetail, asSheet, sheetLine, stacked, onChange }: PacePickerProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const sheet = useRef<HTMLDialogElement | null>(null);
  const sheetHeading = useId();
  const label = `Pace for ${subject}`;

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useDismissOnOutside(open && !asSheet, close, root);

  useEffect(() => {
    if (open && !asSheet) options.current[PLAYLIST_PACES.indexOf(pace)]?.focus();
  }, [open, asSheet, pace]);

  useEffect(() => {
    const element = sheet.current;
    if (element === null) return;
    if (open && asSheet && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open, asSheet]);

  const choose = (next: PlaylistPace) => {
    if (next !== pace) onChange(next);
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = options.current.indexOf(document.activeElement as HTMLButtonElement);
    const last = PLAYLIST_PACES.length - 1;
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
        aria-label={`${label}: ${PACE_LABEL[pace]}`}
        aria-haspopup={asSheet ? "dialog" : "menu"}
        aria-expanded={open}
        data-testid={pacePickerTestIds.trigger}
      >
        <StrokeIcon name="gauge" size={14} />
        {PACE_LABEL[pace]}
        <StrokeIcon name="chevronDown" size={14} />
      </button>

      {open && !asSheet && (
        <div className={styles.menu} role="menu" aria-label={label} onKeyDown={moveFocus} data-testid={pacePickerTestIds.menu}>
          {PLAYLIST_PACES.map((option, index) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === pace}
              tabIndex={-1}
              ref={(element) => {
                options.current[index] = element;
              }}
              className={styles.item}
              onClick={() => {
                close();
                choose(option);
              }}
              data-testid={pacePickerTestIds.option(option)}
            >
              <span className={styles.check} aria-hidden="true">
                {option === pace && <StrokeIcon name="check" size={16} />}
              </span>
              <span className={styles.itemText}>
                <span className={styles.itemName}>{PACE_LABEL[option]}</span>
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
          data-testid={pacePickerTestIds.sheet}
        >
          <div className={styles.sheetPanel}>
            <span className={styles.handle} aria-hidden="true" />
            <div className={styles.sheetHead}>
              <h2 className={styles.sheetTitle} id={sheetHeading}>
                Pace
              </h2>
              {sheetLine !== undefined && <p className={styles.sheetLine}>{sheetLine}</p>}
            </div>
            <div className={styles.radios} role="radiogroup" aria-label={label}>
              {PLAYLIST_PACES.map((option) => (
                <label key={option} className={styles.radioOption} data-testid={pacePickerTestIds.option(option)}>
                  <input
                    type="radio"
                    name={`pace-${sheetHeading}`}
                    className={styles.radio}
                    value={option}
                    checked={option === pace}
                    onChange={() => choose(option)}
                  />
                  <span className={styles.itemText}>
                    <span className={styles.itemName}>{PACE_LABEL[option]}</span>
                    {optionDetail !== undefined && <span className={styles.itemDetail}>{optionDetail(option)}</span>}
                  </span>
                </label>
              ))}
            </div>
            <p className={styles.sheetFoot}>Saved as soon as you choose. Videos you make by hand never count toward it.</p>
            <button type="button" className={styles.done} onClick={close} data-testid={pacePickerTestIds.doneButton}>
              Done
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
