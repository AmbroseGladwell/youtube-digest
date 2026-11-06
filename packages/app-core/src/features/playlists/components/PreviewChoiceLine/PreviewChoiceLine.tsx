import { useEffect, useId, useRef, useState } from "react";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./PreviewChoiceLine.module.scss";
import { previewChoiceLineTestIds } from "./PreviewChoiceLineTestIds.js";

export interface PreviewChoiceLineProps<Choice extends string> {
  choice: Choice;
  choices: readonly Choice[];
  theDefault: Choice;
  labelOf: (choice: Choice) => string;
  resultOf: (choice: Choice) => string;
  // What is being chosen, for the test ids and the radio group's name: "pace", "order".
  name: string;
  // The two halves of the control's label: "Pace" for "Psychology".
  title: string;
  subject: string;
  icon: StrokeIconName;
  stacked: boolean;
  onChange: (choice: Choice) => void;
}

// Design 95t–95v: the choice sits behind one line with Change, because the reader's default
// needs no attention. Change opens the options in place as a radio group, each with its result
// written out; choosing is immediate and there is no Done.
export function PreviewChoiceLine<Choice extends string>({
  choice,
  choices,
  theDefault,
  labelOf,
  resultOf,
  name,
  title,
  subject,
  icon,
  stacked,
  onChange,
}: PreviewChoiceLineProps<Choice>) {
  const [choosing, setChoosing] = useState(false);
  const chosenOption = useRef<HTMLInputElement>(null);
  const group = useId();
  const resultId = `${group}-result`;

  useEffect(() => {
    if (choosing) chosenOption.current?.focus();
  }, [choosing]);

  if (choosing) {
    return (
      <div className={styles.root}>
        <div className={styles.choice} role="radiogroup" aria-labelledby={group} data-testid={previewChoiceLineTestIds.choice(name)}>
          <p className={styles.choiceLabel} id={group}>
            {title} for {subject}
          </p>
          {choices.map((option) => (
            <label
              key={option}
              className={`${styles.option} ${stacked ? styles.optionStacked : ""}`}
              data-testid={previewChoiceLineTestIds.option(name, option)}
            >
              <input
                ref={option === choice ? chosenOption : undefined}
                type="radio"
                name={group}
                className={styles.radio}
                value={option}
                checked={option === choice}
                onChange={() => onChange(option)}
              />
              <span className={styles.optionText}>
                <span className={styles.optionName}>
                  {labelOf(option)}
                  {option === theDefault && <span className={styles.default}> · your default</span>}
                </span>
                <span className={styles.optionResult}>{resultOf(option)}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.line} data-testid={previewChoiceLineTestIds.line(name)}>
        <span className={styles.icon} aria-hidden="true">
          <StrokeIcon name={icon} size={16} />
        </span>
        <span className={styles.text}>
          <span className={styles.name} data-testid={previewChoiceLineTestIds.name(name)}>
            <strong>{title}:</strong> {labelOf(choice)}
            {choice === theDefault && <span className={styles.default}> · your default</span>}
          </span>
          <span className={styles.result} id={resultId} data-testid={previewChoiceLineTestIds.result(name)}>
            {resultOf(choice)}
          </span>
        </span>
        <button
          type="button"
          className={`${styles.change} ${stacked ? styles.changeStacked : ""}`}
          aria-label={`Change ${title.toLowerCase()} for ${subject}`}
          aria-expanded={false}
          aria-describedby={resultId}
          onClick={() => setChoosing(true)}
          data-testid={previewChoiceLineTestIds.changeButton(name)}
        >
          Change
        </button>
      </div>
    </div>
  );
}
