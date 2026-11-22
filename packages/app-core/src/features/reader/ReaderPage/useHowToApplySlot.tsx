import { composeReaderContext, HOW_TO_APPLY_SECTION, type Overview } from "@overview/domain";
import { Routes } from "../../../app/Routes.js";
import { PageLink } from "../../../components/shared/PageLink/PageLink.js";
import { useSettingsQuery } from "../../settings/queries/settingsQuery.js";
import styles from "../components/HowToApplyLine/HowToApplyLine.module.scss";
import { howToApplyLineTestIds } from "../components/HowToApplyLine/HowToApplyLineTestIds.js";
import type { NoteSectionSlot } from "../components/ReadAlongNote/ReadAlongNote.js";
import { isRevealedSample } from "../../onboarding/nextStepsStorage.js";

// A sample has no version written for the reader, so it says so (155j). Beside the steps a source
// gives, How to apply says whose it is: a Personalised tag when we know the reader, and the way
// to tell us when we don't (designs 250a, 250p).
export function useHowToApplySlot(overview: Overview | null, besideSteps: boolean): NoteSectionSlot | null {
  const settings = useSettingsQuery().data;
  const hasItems = (overview?.howToApply?.items.length ?? 0) > 0;
  if (isRevealedSample(overview?.id ?? null) && hasItems) {
    return {
      section: HOW_TO_APPLY_SECTION,
      beside: null,
      under: (
        <p className={styles.line} data-testid={howToApplyLineTestIds.sampleLine}>
          Written for anyone, like every sample. The overviews you make are written for you.
        </p>
      ),
    };
  }
  if (!besideSteps || !hasItems || settings === undefined) return null;
  const known = composeReaderContext(settings.aboutYou, settings.learned) !== null;
  return {
    section: HOW_TO_APPLY_SECTION,
    beside: known ? (
      <span className={styles.personalised} data-testid={howToApplyLineTestIds.personalised}>
        Personalised
      </span>
    ) : null,
    under: known ? null : (
      <p className={styles.line} data-testid={howToApplyLineTestIds.forAnyoneLine}>
        <PageLink to={Routes.settingsSection("personalisation")} className={styles.link}>
          Tell us about yourself
        </PageLink>{" "}
        in Settings and these fit around you.
      </p>
    ),
  };
}
