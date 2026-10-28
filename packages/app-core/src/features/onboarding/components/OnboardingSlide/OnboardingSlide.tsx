import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingSlide.module.scss";
import { onboardingSlideTestIds } from "./OnboardingSlideTestIds.js";

export type OnboardingSlideName = "library" | "askYourAi" | "moreSources";

const SLIDES: Record<OnboardingSlideName, { title: string; body: string }> = {
  library: {
    title: "A library that sorts itself",
    body: "Every overview lands under your topics, ready whenever you need it.",
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
  onNext: () => void;
}

// Designs 46e, 46h and 46i: the benefit each question pays off, after it. A slide moves only
// on Next or Skip, never by itself, and its scene is built from the app's own parts and hidden
// from screen readers.
export function OnboardingSlide({ slide, topics, onNext }: OnboardingSlideProps) {
  const { title, body } = SLIDES[slide];
  return (
    <div className={styles.root} data-testid={onboardingSlideTestIds.root}>
      <div className={styles.scene} aria-hidden="true">
        <Scene slide={slide} topics={topics} />
      </div>
      <div className={styles.intro}>
        <OnboardingHeading>{title}</OnboardingHeading>
        <p className={styles.lead}>{body}</p>
      </div>
      <div className={styles.foot}>
        <button type="button" className={styles.primary} onClick={onNext} data-testid={onboardingSlideTestIds.next}>
          Next
        </button>
      </div>
    </div>
  );
}

function Scene({ slide, topics }: { slide: OnboardingSlideName; topics: readonly string[] }) {
  if (slide === "library") {
    const shown = topics.length > 0 ? topics.slice(0, 5) : ["Science", "Health", "Food"];
    return (
      <div className={styles.card}>
        <span className={styles.cardLabel}>Your topics</span>
        {shown.map((name, index) => (
          <span key={name} className={`${styles.topicRow} ${index === shown.length - 1 ? styles.topicRowArriving : ""}`}>
            <span>{name}</span>
            {index === shown.length - 1 && <span className={styles.arriving}>+1 arriving</span>}
          </span>
        ))}
      </div>
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
        ["Podcasts", "Soon"],
        ["Articles", "Soon"],
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
