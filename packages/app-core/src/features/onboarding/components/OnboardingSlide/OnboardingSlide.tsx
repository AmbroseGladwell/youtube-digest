import type { Source } from "@overview/domain";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { shownTopics } from "../../util/shownTopics.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./OnboardingSlide.module.scss";
import { onboardingSlideTestIds } from "./OnboardingSlideTestIds.js";

export type OnboardingSlideName = "library" | "askYourAi" | "moreSources";

const SLIDES: Record<OnboardingSlideName, { title: string; body: string }> = {
  library: {
    title: "A library that sorts itself",
    body: "As each overview is written, we check it against your topics and add it to the ones it fits best, if any.",
  },
  askYourAi: {
    title: "Ask your AI about anything you've saved",
    body: "Connect your AI assistant and it can search your library, pull up overviews and answer questions from what you've kept.",
  },
  moreSources: {
    title: "More sources on the way",
    body: "Podcasts, articles, PDFs and more are coming soon, all in the same library.",
  },
};

export interface OnboardingSlideProps {
  slide: OnboardingSlideName;
  topics: readonly string[];
  // The reader's own source, for the library slide's scene; null until it's found.
  source: Source | null;
  // Already written (a sample or a shared copy), so it waits to be sorted rather than written.
  written: boolean;
  onNext: () => void;
}

const LIBRARY_WITH_NO_TOPICS =
  "Overviews wait in Unsorted until you add topics. Add one any time, and we'll check new overviews against it as they're written.";
const TOPICS_SHOWN = 5;

// Designs 46e, 46h and 46i: the benefit each question pays off, after it. A slide moves only
// on Next or Skip, never by itself, and its scene is built from the app's own parts and hidden
// from screen readers.
export function OnboardingSlide({ slide, topics, source, written, onNext }: OnboardingSlideProps) {
  const { title } = SLIDES[slide];
  const body = slide === "library" && topics.length === 0 ? LIBRARY_WITH_NO_TOPICS : SLIDES[slide].body;
  return (
    <div className={styles.root} data-testid={onboardingSlideTestIds.root}>
      <div className={styles.scene} aria-hidden="true" data-testid={onboardingSlideTestIds.scene}>
        <Scene slide={slide} topics={topics} source={source} written={written} />
      </div>
      <div className={styles.intro}>
        <OnboardingHeading>{title}</OnboardingHeading>
        <p className={styles.lead} data-testid={onboardingSlideTestIds.lead}>
          {body}
        </p>
      </div>
      <div className={styles.foot}>
        <button type="button" className={styles.primary} onClick={onNext} data-testid={onboardingSlideTestIds.next}>
          Next
        </button>
      </div>
    </div>
  );
}

// 175c: the reader's own source and topics, with no result claimed, since nothing is filed
// until it's written (docs/features/onboarding.md, "The library slide").
function Scene({
  slide,
  topics,
  source,
  written,
}: {
  slide: OnboardingSlideName;
  topics: readonly string[];
  source: Source | null;
  written: boolean;
}) {
  if (slide === "library") {
    const { shown, more } = shownTopics(topics, TOPICS_SHOWN);
    return (
      <>
        {source !== null && (
          <span className={styles.sourceCard}>
            <OverviewThumbnail video={source} className={styles.sourceThumb} />
            <span className={styles.sourceText}>
              <span className={styles.sourceTitle}>{source.title}</span>
              <span className={styles.sourceState}>Your overview · {written ? "not sorted yet" : "not written yet"}</span>
            </span>
          </span>
        )}
        <span className={styles.checked}>
          <StrokeIcon name="chevronDown" size={14} />
          {topics.length > 0 ? "Overviews are checked against these once they're written" : "No topics yet, so it waits in"}
        </span>
        <span className={styles.topicPills}>
          {topics.length > 0 ? (
            <>
              {shown.map((name) => (
                <span key={name} className={styles.topicPill}>
                  {name}
                </span>
              ))}
              {more > 0 && <span className={styles.morePill}>and {more} more</span>}
            </>
          ) : (
            <span className={styles.unsortedPill}>Unsorted</span>
          )}
        </span>
      </>
    );
  }
  if (slide === "askYourAi") {
    return (
      <div className={styles.chat}>
        <span className={styles.bubbleMine}>What have I saved about sleep?</span>
        <span className={styles.bubble}>
          Two overviews in Health. <strong>Why Sleep Comes First</strong> says to keep the same wake time, even at
          weekends.
        </span>
      </div>
    );
  }
  return (
    <div className={styles.card}>
      {[
        ["Videos", "Now"],
        ["Articles", "Now"],
        ["Podcasts", "Soon"],
        ["PDFs", "Soon"],
      ].map(([name, when]) => (
        <span key={name} className={`${styles.sourceRow} ${when === "Now" ? styles.sourceNow : ""}`}>
          <span>{name}</span>
          <span className={styles.when}>{when}</span>
        </span>
      ))}
    </div>
  );
}
