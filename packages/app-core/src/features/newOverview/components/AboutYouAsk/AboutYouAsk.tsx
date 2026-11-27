import type { AboutYou, AboutYouSection } from "@overview/domain";
import type { Ref } from "react";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { AboutYouEditor } from "../../../settings/components/AboutYouEditor/AboutYouEditor.js";
import type { NewOverviewRun } from "../../types/NewOverviewRun.js";
import type { AboutYouAsking } from "../../useAboutYouAsk.js";
import { justNowRowOf } from "../JustNowList/justNowRowOf.js";
import styles from "./AboutYouAsk.module.scss";
import { aboutYouAskTestIds } from "./AboutYouAskTestIds.js";

export const ABOUT_YOU_ASK_TITLE_ID = "about-you-ask-title";
export const ABOUT_YOU_ASK_WHY_ID = "about-you-ask-why";

const FOR_THIS: Record<AboutYouAsking["sourceKind"], string> = {
  video: "For this video",
  article: "For this article",
  podcast: "For this episode",
};

export interface AboutYouAskWaitingProps {
  run: NewOverviewRun | null;
  sourceKind: AboutYouAsking["sourceKind"];
}

// Design 356a: what is waiting on the answer, so nothing seems lost.
export const AboutYouAskWaiting = ({ run, sourceKind }: AboutYouAskWaitingProps) => (
  <div className={styles.waiting} role="note" data-testid={aboutYouAskTestIds.waiting}>
    {run?.video == null ? (
      <span className={styles.placeholder} aria-hidden="true">
        <StrokeIcon name="link" size={15} />
      </span>
    ) : (
      <OverviewThumbnail video={run.video} className={styles.thumbnail} />
    )}
    <span className={styles.waitingText}>
      <span className={styles.kicker}>{FOR_THIS[sourceKind]}</span>
      {run !== null && <span className={styles.waitingTitle}>{justNowRowOf(run).title}</span>}
      <span className={styles.promise}>
        <StrokeIcon name="user" size={13} />
        Written for you once you continue
      </span>
    </span>
  </div>
);

export interface AboutYouAskProps {
  answer: AboutYou;
  topicNames: readonly string[];
  titleRef?: Ref<HTMLHeadingElement>;
  onChange: (section: AboutYouSection, entries: string[]) => void;
}

// docs/features/personalisation.md, "Asked once more" (designs 356a–356f).
export const AboutYouAsk = ({ answer, topicNames, titleRef, onChange }: AboutYouAskProps) => (
  <div className={styles.root} data-testid={aboutYouAskTestIds.root}>
    <p className={styles.label}>About you</p>
    <h2 ref={titleRef} id={ABOUT_YOU_ASK_TITLE_ID} className={styles.title} tabIndex={-1} data-testid={aboutYouAskTestIds.title}>
      Make it yours.
    </h2>
    <p id={ABOUT_YOU_ASK_WHY_ID} className={styles.why}>
      Share a little about you, and How to apply and chat answers are written for your life.
    </p>
    <AboutYouEditor aboutYou={answer} size="ask" topicNames={topicNames} onChange={onChange} />
    <p className={styles.hint}>Tap a section to fill it in. Add as much as you like, or leave one empty.</p>
    <p className={styles.note}>Change it anytime in Settings. It’s sent to our AI provider with each overview made on us.</p>
  </div>
);

export interface AboutYouAskFootProps {
  saving: boolean;
  stacked: boolean;
  onContinue: () => void;
  onSkip: () => void;
}

export const AboutYouAskFoot = ({ saving, stacked, onContinue, onSkip }: AboutYouAskFootProps) => (
  <div className={`${styles.foot} ${stacked ? styles.stacked : ""}`}>
    <button
      type="button"
      className={styles.continue}
      aria-disabled={saving}
      aria-busy={saving}
      onClick={() => {
        if (!saving) {
          onContinue();
        }
      }}
      data-testid={aboutYouAskTestIds.continue}
    >
      {saving && <span className={styles.spinner} aria-hidden="true" />}
      Continue
    </button>
    <button type="button" className={styles.skip} disabled={saving} onClick={onSkip} data-testid={aboutYouAskTestIds.skip}>
      Skip
    </button>
  </div>
);
