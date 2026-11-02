import { aboutYouIsEmpty, aboutYouSentence, type AboutYou } from "@overview/domain";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingStepsForYou.module.scss";
import { onboardingStepsForYouTestIds } from "./OnboardingStepsForYouTestIds.js";

const FOR_ANYONE = ["Keep the same wake time every day, weekends included.", "Stop caffeine by early afternoon."];
const FOR_YOU = [
  "Late evenings on side projects are fine if your wake time doesn't move. Guard the morning, not the bedtime.",
  "Play basketball before dinner rather than late: hard exercise close to bed keeps you up.",
];

export interface OnboardingStepsForYouProps {
  aboutYou: AboutYou;
  onPersonalise: () => void;
  onNext: () => void;
}

function Steps({ steps }: { steps: readonly string[] }) {
  return (
    <ul className={styles.steps}>
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ul>
  );
}

// Designs 141j and 141f: fixed, illustrative steps with the reader's own sentence quoted, and
// none of their overview, which isn't written yet. An empty sentence asks once more
// (docs/features/onboarding.md, "Writing waits for the answers").
export function OnboardingStepsForYou({ aboutYou, onPersonalise, onNext }: OnboardingStepsForYouProps) {
  const isPanel = useIsPanel();
  const skipped = aboutYouIsEmpty(aboutYou);
  const shown = (steps: readonly string[]) => (isPanel ? steps.slice(0, 1) : steps);

  return (
    <div className={styles.root} data-testid={onboardingStepsForYouTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading>{skipped ? "Let's make your overviews personal and actionable" : "Steps that fit around you"}</OnboardingHeading>
        <p className={styles.lead}>
          {skipped
            ? "Tell us a little about yourself and every overview ends with steps that fit your life. It takes a minute, and you can add it later in Settings."
            : isPanel
              ? "With the context you've given, the steps at the end of each overview are written around you."
              : "Each overview ends with a few steps to put it into practice. With the context you've given, those steps are written around you."}
        </p>
      </div>

      <figure className={styles.scene} aria-label="An example of How to apply">
        <figcaption className={styles.caption}>An example: How to apply, from a video on sleep</figcaption>
        <div className={styles.card}>
          <span className={styles.label}>For anyone</span>
          <Steps steps={shown(FOR_ANYONE)} />
        </div>
        {skipped ? (
          <div className={styles.waiting}>
            <span className={styles.label}>For you</span>
            <span className={styles.waitingLine}>Personalise your overviews and these steps are written around your life.</span>
          </div>
        ) : (
          <div className={styles.cardYou}>
            <span className={styles.label}>For you</span>
            <p className={styles.quote} data-testid={onboardingStepsForYouTestIds.quote}>
              "{aboutYouSentence(aboutYou)}"
            </p>
            <Steps steps={shown(FOR_YOU)} />
          </div>
        )}
      </figure>

      <div className={styles.foot}>
        {skipped && (
          <button type="button" className={styles.personalise} onClick={onPersonalise} data-testid={onboardingStepsForYouTestIds.personalise}>
            Personalise my overviews
          </button>
        )}
        <button type="button" className={styles.primary} onClick={onNext} data-testid={onboardingStepsForYouTestIds.next}>
          Next
        </button>
      </div>
    </div>
  );
}
