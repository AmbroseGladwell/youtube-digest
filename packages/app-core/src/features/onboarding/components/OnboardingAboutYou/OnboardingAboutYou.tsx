import { useState } from "react";
import type { AboutYou } from "@overview/domain";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { AboutYouEditor } from "../../../settings/components/AboutYouEditor/AboutYouEditor.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingAboutYou.module.scss";
import { onboardingAboutYouTestIds } from "./OnboardingAboutYouTestIds.js";

export interface OnboardingAboutYouProps {
  aboutYou: AboutYou;
  topicNames: readonly string[];
  saving: boolean;
  onContinue: (answer: AboutYou) => void;
}

export const OnboardingAboutYou = ({ aboutYou, topicNames, saving, onContinue }: OnboardingAboutYouProps) => {
  const [answer, setAnswer] = useState(aboutYou);
  const isPanel = useIsPanel();

  return (
    <div className={styles.root} data-testid={onboardingAboutYouTestIds.root}>
      <div className={styles.sentence}>
        <span className={styles.label}>About you</span>
        <OnboardingHeading>Make it yours.</OnboardingHeading>
        <AboutYouEditor
          aboutYou={answer}
          size="hero"
          topicNames={topicNames}
          onChange={(section, entries) => setAnswer((current) => ({ ...current, [section]: entries }))}
        />
      </div>

      <p className={styles.lead}>
        {isPanel
          ? "Tap a section to fill it in, or leave one empty."
          : "Tap a section to fill it in. Add as much as you like, or leave one empty."}
      </p>

      <p className={styles.costNote}>
        You can update this anytime in Settings. When overviews are made on us, this is sent with each one to the AI provider we use to
        write them.
      </p>

      <div className={styles.foot}>
        <button
          type="button"
          className={styles.primary}
          disabled={saving}
          onClick={() => onContinue(answer)}
          data-testid={onboardingAboutYouTestIds.continue}
        >
          Continue
        </button>
      </div>
    </div>
  );
};
