import { useState } from "react";
import type { AboutYou } from "@overview/domain";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
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

// Design 141a: a sentence to finish, not a form. Nothing here is required, and What this
// changes shows what the sentence buys before a word is written
// (docs/features/personalisation.md).
export function OnboardingAboutYou({ aboutYou, topicNames, saving, onContinue }: OnboardingAboutYouProps) {
  const [answer, setAnswer] = useState(aboutYou);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isPanel = useIsPanel();
  const isPhone = useIsPhone();

  return (
    <div className={styles.root} data-testid={onboardingAboutYouTestIds.root}>
      <div className={styles.sentence}>
        <OnboardingHeading small>About you</OnboardingHeading>
        <AboutYouEditor
          aboutYou={answer}
          size="hero"
          topicNames={topicNames}
          onChange={(section, entries) => setAnswer((current) => ({ ...current, [section]: entries }))}
          onSheetOpen={setSheetOpen}
        />
      </div>

      <p className={styles.lead}>
        {isPanel
          ? "Tap a section to fill it in, or leave one empty."
          : "Tap a section to fill it in. Add as much as you like, or leave one empty."}
      </p>

      {(!sheetOpen || isPanel || isPhone) && (
        <figure className={styles.why} aria-label="What this changes" data-testid={onboardingAboutYouTestIds.why}>
          <figcaption className={styles.whyTitle}>What this changes</figcaption>
          <p className={styles.whyBody}>
            Each overview ends with a few steps to put it into practice. The more context you give, the more those steps
            fit around you.
          </p>
          {!isPanel && (
            <div className={styles.whyExample}>
              <div className={styles.whyStep}>
                <span className={styles.whyLabel}>From a knife skills video, for anyone</span>
                <span className={styles.whyMuted}>Practise the claw grip on one onion a day.</span>
              </div>
              <div className={styles.whyStep}>
                <span className={styles.whyLabelYou}>For a dad who cooks after work</span>
                <span>Dice a week of onions on Sunday, so weeknight dinners start at the pan.</span>
              </div>
            </div>
          )}
        </figure>
      )}

      <p className={styles.costNote}>When overviews are made on us, this goes through our server to OpenAI with each one.</p>

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
}
