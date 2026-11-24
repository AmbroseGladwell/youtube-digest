import type { ReactNode } from "react";
import { StrokeIcon } from "../StrokeIcon/StrokeIcon.js";
import styles from "./ChoiceGroup.module.scss";

export interface Choice {
  value: string;
  label: ReactNode;
  count?: number;
  detail?: string;
  leading?: ReactNode;
  testId?: string;
}

export interface ChoiceGroupProps {
  legend: string;
  name: string;
  look: "chips" | "rows";
  multiple: boolean;
  choices: readonly Choice[];
  chosen: readonly string[];
  onChoose: (value: string, chosen: boolean) => void;
  testId?: string;
}

// Native radios and checkboxes in a fieldset, drawn as chips or rows: design 399o-0.
export const ChoiceGroup = ({ legend, name, look, multiple, choices, chosen, onChoose, testId }: ChoiceGroupProps) => {
  return (
    <fieldset className={look === "chips" ? styles.chips : styles.rows} data-testid={testId}>
      <legend className={styles.legend}>{legend}</legend>
      {choices.map((choice) => {
        const on = chosen.includes(choice.value);
        return (
          <label key={choice.value} className={`${styles.choice} ${on ? styles.on : ""}`} data-testid={choice.testId}>
            <input
              className={styles.input}
              type={multiple ? "checkbox" : "radio"}
              name={name}
              value={choice.value}
              checked={on}
              onChange={(event) => onChoose(choice.value, event.target.checked)}
            />
            {look === "rows" && (
              <span className={`${styles.box} ${multiple ? styles.check : styles.radio}`} aria-hidden="true">
                {multiple && on && <StrokeIcon name="check" size={12} />}
              </span>
            )}
            {choice.leading}
            <span className={styles.label}>
              {choice.label}
              {choice.detail !== undefined && <span className={styles.detail}> {choice.detail}</span>}
            </span>
            {choice.count !== undefined && <small className={styles.count}>{choice.count}</small>}
          </label>
        );
      })}
    </fieldset>
  );
};
