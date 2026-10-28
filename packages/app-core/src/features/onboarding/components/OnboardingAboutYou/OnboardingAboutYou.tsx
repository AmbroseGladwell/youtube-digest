import { useId, useRef, useState } from "react";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import {
  ABOUT_YOU_GOALS,
  ABOUT_YOU_ROLES,
  aboutYouLine,
  MAX_ABOUT_YOU_LENGTH,
  toggledGoals,
  type AboutYouGoal,
  type AboutYouRole,
} from "../../../settings/util/aboutYou.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingAboutYou.module.scss";
import { onboardingAboutYouTestIds } from "./OnboardingAboutYouTestIds.js";

// The panel shows five of each, with More for the rest (design 46o).
const PANEL_CHIPS = 5;

export interface AboutYouAnswer {
  readerContext: string | null;
  role: boolean;
  goals: number;
  ownWords: boolean;
}

export interface OnboardingAboutYouProps {
  readerContext: string | null;
  saving: boolean;
  onContinue: (answer: AboutYouAnswer) => void;
}

// Design 46f, exploration B with A as an inset: one thing they do and up to two to get better
// at build a line, or their own words, at most 140 characters, take its place. The line is
// the reader context generation reads, so the screen says where it goes on us
// (docs/features/personalisation.md).
export function OnboardingAboutYou({ readerContext, saving, onContinue }: OnboardingAboutYouProps) {
  const [role, setRole] = useState<AboutYouRole | null>(null);
  const [goals, setGoals] = useState<AboutYouGoal[]>([]);
  const [ownWords, setOwnWords] = useState(readerContext ?? "");
  const isPanel = useIsPanel();
  const [allShown, setAllShown] = useState(false);
  const shown = <T,>(list: readonly T[]): readonly T[] => (isPanel && !allShown ? list.slice(0, PANEL_CHIPS) : list);
  const more = isPanel && !allShown && (
    <button type="button" className={styles.more} aria-expanded={false} onClick={() => setAllShown(true)}>
      More
    </button>
  );
  const ownWordsField = useRef<HTMLInputElement | null>(null);
  const roleLabel = useId();
  const goalLabel = useId();
  const fieldId = useId();
  const built = aboutYouLine(role, goals);
  const line = ownWords.trim() !== "" ? ownWords.trim() : built;

  return (
    <div className={styles.root} data-testid={onboardingAboutYouTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading>How should we write your overviews?</OnboardingHeading>
        <p className={styles.lead}>Tell us a little about you and we'll pitch each overview at the right level.</p>
      </div>

      <div className={styles.group} role="group" aria-labelledby={roleLabel}>
        <p id={roleLabel} className={styles.groupLabel}>
          What you do<span className={styles.note}> · pick one</span>
        </p>
        <div className={styles.chips}>
          {shown(ABOUT_YOU_ROLES).map(({ label }) => (
            <button
              key={label}
              type="button"
              className={styles.chip}
              aria-pressed={role === label}
              onClick={() => setRole((current) => (current === label ? null : label))}
              data-testid={onboardingAboutYouTestIds.role(label)}
            >
              {role === label && <StrokeIcon name="check" size={14} />}
              {label}
            </button>
          ))}
          {more}
        </div>
      </div>

      <div className={styles.group} role="group" aria-labelledby={goalLabel}>
        <p id={goalLabel} className={styles.groupLabel}>
          What you want to get better at<span className={styles.note}> · up to two</span>
        </p>
        <div className={styles.chips}>
          {shown(ABOUT_YOU_GOALS).map((goal) => (
            <button
              key={goal}
              type="button"
              className={styles.chip}
              aria-pressed={goals.includes(goal)}
              onClick={() => setGoals((current) => toggledGoals(current, goal))}
              data-testid={onboardingAboutYouTestIds.goal(goal)}
            >
              {goals.includes(goal) && <StrokeIcon name="check" size={14} />}
              {goal}
            </button>
          ))}
          {more}
        </div>
      </div>

      <div className={styles.built}>
        <span className={styles.builtText}>
          <span className={styles.builtLabel}>We'll write for</span>
          <span className={line === "" ? styles.builtEmpty : styles.builtLine} aria-live="polite" data-testid={onboardingAboutYouTestIds.line}>
            {line === "" ? "Pick what fits, or write your own." : line}
          </span>
        </span>
        {built !== "" && ownWords.trim() === "" && (
          <button
            type="button"
            className={styles.edit}
            aria-label="Edit the line"
            onClick={() => {
              setOwnWords(built.slice(0, MAX_ABOUT_YOU_LENGTH));
              ownWordsField.current?.focus();
            }}
            data-testid={onboardingAboutYouTestIds.edit}
          >
            <StrokeIcon name="pencil" size={14} />
            Edit
          </button>
        )}
      </div>

      <div className={styles.own}>
        <label htmlFor={fieldId} className={styles.ownLabel}>
          Prefer your own words?
        </label>
        <input
          id={fieldId}
          ref={ownWordsField}
          className={styles.ownField}
          placeholder="For example: A nurse learning to cook"
          value={ownWords}
          maxLength={MAX_ABOUT_YOU_LENGTH}
          onChange={(event) => setOwnWords(event.target.value)}
          data-testid={onboardingAboutYouTestIds.ownWords}
        />
        <span className={styles.counter}>
          {ownWords.length} / {MAX_ABOUT_YOU_LENGTH}
        </span>
      </div>

      <p className={styles.costNote}>When overviews are made on us, this goes through our server to OpenAI with each one.</p>

      <div className={styles.foot}>
        <button
          type="button"
          className={styles.primary}
          disabled={saving}
          onClick={() =>
            onContinue({
              readerContext: line === "" ? null : line,
              role: role !== null,
              goals: goals.length,
              ownWords: ownWords.trim() !== "",
            })
          }
          data-testid={onboardingAboutYouTestIds.continue}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
