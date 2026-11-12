import { useState } from "react";
import { composeReaderContext, EMPTY_ABOUT_YOU, firstAboutYouText, HOW_TO_APPLY_SECTION, type Overview } from "@overview/domain";
import { Routes } from "../../../app/Routes.js";
import { PageLink } from "../../../components/shared/PageLink/PageLink.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { useSettingsQuery } from "../../settings/queries/settingsQuery.js";
import { HowToApplyFlip, type FlipSide } from "../components/HowToApplyFlip/HowToApplyFlip.js";
import styles from "../components/HowToApplyFlip/HowToApplySteps.module.scss";
import { howToApplyFlipTestIds } from "../components/HowToApplyFlip/HowToApplyFlipTestIds.js";
import type { NoteSectionSlot } from "../components/ReadAlongNote/ReadAlongNote.js";
import { isRevealedSample } from "../../onboarding/nextStepsStorage.js";
import { useForAnyoneSteps } from "./useForAnyoneSteps.js";

// Design 141o: the reveal's flip, worn by How to apply. Written for you stays the note's own
// lines; For anyone stands in for them without moving what the voice reads. A sample has no
// version written for the reader, so it says so instead and offers no flip (155j).
//
// Beside the steps a source gives, How to apply says whose it is: a Personalised tag when we know
// the reader, and the way to tell us when we don't (designs 250a, 250p).
export function useHowToApplySlot(overview: Overview | null, besideSteps: boolean): NoteSectionSlot | null {
  const steps = useForAnyoneSteps(overview);
  const settings = useSettingsQuery().data;
  const aboutYou = settings?.aboutYou ?? EMPTY_ABOUT_YOU;
  const analytics = useAnalytics();
  const [side, setSide] = useState<FlipSide>("you");
  if (isRevealedSample(overview?.id ?? null) && (overview?.howToApply?.items.length ?? 0) > 0) {
    return {
      section: HOW_TO_APPLY_SECTION,
      beside: null,
      under: (
        <p className={styles.line} data-testid={howToApplyFlipTestIds.sampleLine}>
          Written for anyone, like every sample. The overviews you make are written for you.
        </p>
      ),
      replacement: null,
    };
  }
  if (steps.status === "hidden") {
    if (!besideSteps || (overview?.howToApply?.items.length ?? 0) === 0 || settings === undefined) return null;
    const known = composeReaderContext(settings.aboutYou, settings.learned) !== null;
    return {
      section: HOW_TO_APPLY_SECTION,
      beside: known ? (
        <span className={styles.personalised} data-testid={howToApplyFlipTestIds.personalised}>
          Personalised
        </span>
      ) : null,
      under: known ? null : (
        <p className={styles.line} data-testid={howToApplyFlipTestIds.forAnyoneLine}>
          <PageLink to={Routes.settingsSection("personalisation")} className={styles.link}>
            Tell us about yourself
          </PageLink>{" "}
          in Settings and these fit around you.
        </p>
      ),
      replacement: null,
    };
  }

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
