import { ABOUT_YOU_SECTIONS, type AboutYouSection } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { ABOUT_YOU_SECTION_COPY } from "../../../settings/util/aboutYouCopy.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingStepsMoment.module.scss";
import { onboardingStepsMomentTestIds } from "./OnboardingStepsMomentTestIds.js";
import { onboardingPageTestIds } from "../../OnboardingPage/OnboardingPageTestIds.js";

const HEADING = "Steps that fit your life.";
const leadFor = (noun: OnboardingStepsMomentProps["noun"]): string =>
  noun === "recipe"
    ? "In every video, article and podcast, How to apply is written for you, and you can ask anything about them in chat."
    : `How to apply is written for you, and you can ask anything about the ${noun} in chat or use one of the suggested follow-up questions.`;
const EXAMPLE_LABEL = "Example About you";
const EXAMPLE: Record<AboutYouSection, string> = {
  who: "a gym regular",
  time: "lifting and walking",
  focus: "rehabbing my knee so I can get back to hiking",
};
const OVERVIEW_LABEL = "In every overview";
const HOW_TO_APPLY = "How to apply";
const PERSONALISED = "Personalised";
const STEP = "Swap heavy squats for slow step-downs off a low box, and add one hill walk with a light pack each weekend.";
const CHAT_LABEL = "In chat";
const CHAT_QUESTION = "Which exercises are kind to my knee?";
const CHAT_ANSWER_BEFORE = "Step-downs and split squats, at ";
const CHAT_MOMENT = "12:40";
const CHAT_ANSWER_AFTER = ": slow on the way down, and stop short of pain.";
const CHAT_PLAY = "Play 12:40 to 15:10";
const ADD_CONTEXT = "Add context about you";

export interface OnboardingStepsMomentProps {
  noun: "video" | "article" | "episode" | "recipe";
  onAddContext: () => void;
  // Design 327d: Skip sits beside the button on a moment, not in the stepper.
  onSkip: () => void;
}

export function OnboardingStepsMoment({ noun, onAddContext, onSkip }: OnboardingStepsMomentProps) {
  return (
    <div className={styles.root} data-testid={onboardingStepsMomentTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading>{HEADING}</OnboardingHeading>
        <p className={styles.lead} data-testid={onboardingStepsMomentTestIds.lead}>
          {leadFor(noun)}
        </p>
      </div>

      <figure className={styles.example} aria-label={EXAMPLE_LABEL}>
        <figcaption className={styles.label}>{EXAMPLE_LABEL}</figcaption>
        <p className={styles.sentence}>
          {ABOUT_YOU_SECTIONS.map((section) => (
            <span key={section}>
              {ABOUT_YOU_SECTION_COPY[section].lead}
              <span className={styles.filled}>{EXAMPLE[section]}</span>
            </span>
          ))}
          .
        </p>
      </figure>

      <div className={styles.cards}>
        <figure className={styles.card} aria-label={`An example: ${OVERVIEW_LABEL}`}>
          <figcaption className={styles.label}>
            <StrokeIcon name="sparkle" size={12} />
            {OVERVIEW_LABEL}
          </figcaption>
          <span className={styles.applyHead}>
            <span className={styles.applyTitle}>{HOW_TO_APPLY}</span>
            <span className={styles.personalised}>
              <StrokeIcon name="check" size={10} />
              {PERSONALISED}
            </span>
          </span>
          <p className={styles.step}>{STEP}</p>
        </figure>

        <figure className={styles.card} aria-label={`An example: ${CHAT_LABEL}`}>
          <figcaption className={styles.label}>
            <StrokeIcon name="chat" size={12} />
            {CHAT_LABEL}
          </figcaption>
          <p className={styles.question}>{CHAT_QUESTION}</p>
          <div className={styles.answer}>
            <p className={styles.answerText}>
              {CHAT_ANSWER_BEFORE}
              <strong>{CHAT_MOMENT}</strong>
              {CHAT_ANSWER_AFTER}
            </p>
            <span className={styles.label}>
              <StrokeIcon name="play" size={11} />
              {CHAT_PLAY}
            </span>
          </div>
        </figure>
      </div>

      <div className={styles.foot}>
        <button type="button" className={styles.primary} onClick={onAddContext} data-testid={onboardingStepsMomentTestIds.addContext}>
          {ADD_CONTEXT}
        </button>
        <button type="button" className={styles.quiet} onClick={onSkip} data-testid={onboardingPageTestIds.skip}>
          Skip
        </button>
      </div>
    </div>
  );
}
