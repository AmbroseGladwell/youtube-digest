import { useState } from "react";
import { EMPTY_ABOUT_YOU, firstAboutYouText, HOW_TO_APPLY_SECTION, type Overview } from "@overview/domain";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { useSettingsQuery } from "../../settings/queries/settingsQuery.js";
import { HowToApplyFlip, type FlipSide } from "../components/HowToApplyFlip/HowToApplyFlip.js";
import styles from "../components/HowToApplyFlip/HowToApplySteps.module.scss";
import { howToApplyFlipTestIds } from "../components/HowToApplyFlip/HowToApplyFlipTestIds.js";
import type { NoteSectionSlot } from "../components/ReadAlongNote/ReadAlongNote.js";
import { useForAnyoneSteps } from "./useForAnyoneSteps.js";

// Design 141o: the reveal's flip, worn by How to apply. Written for you stays the note's own
// lines; For anyone stands in for them without moving what the voice reads.
export function useHowToApplySlot(overview: Overview | null): NoteSectionSlot | null {
  const steps = useForAnyoneSteps(overview);
  const aboutYou = useSettingsQuery().data?.aboutYou ?? EMPTY_ABOUT_YOU;
  const analytics = useAnalytics();
  const [side, setSide] = useState<FlipSide>("you");
  if (steps.status === "hidden") return null;

  const anyone = side === "anyone" && steps.status === "ready";
  const who = firstAboutYouText(aboutYou);
  return {
    section: HOW_TO_APPLY_SECTION,
    beside: (
      <HowToApplyFlip
        side={side}
        writing={steps.status === "writing"}
        onChoose={(next) => {
          if (next === side) return;
          analytics.onboarding.writtenForYou.flipped({ to: next });
          setSide(next);
        }}
      />
    ),
    under: (
      <p className={styles.line} aria-live="polite" data-testid={howToApplyFlipTestIds.line}>
        {anyone
          ? "The general version. Switch back to see the steps written for you."
          : who === null
            ? "Written for you."
            : `Written for you: ${who}.`}
      </p>
    ),
    replacement: anyone ? (
      <ol className={styles.steps} data-testid={howToApplyFlipTestIds.steps}>
        {steps.items.map((step) => (
          <li key={step} className={styles.step}>
            {step}
          </li>
        ))}
      </ol>
    ) : null,
  };
}
