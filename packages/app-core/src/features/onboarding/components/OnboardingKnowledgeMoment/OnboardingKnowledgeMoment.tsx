import { useIsPanel } from "../../../../app/LayoutContext.js";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingKnowledgeMoment.module.scss";
import { onboardingKnowledgeMomentTestIds } from "./OnboardingKnowledgeMomentTestIds.js";
import { onboardingPageTestIds } from "../../OnboardingPage/OnboardingPageTestIds.js";

const HEADING = "Your own AI knowledge base.";
const LEAD =
  "Ask questions across everything you've saved, here or in Claude or ChatGPT, and find anything by what it was about, even if you've forgotten the title.";
const ASK_LABEL = "Ask across your library";
const ASK_QUESTION = "What have I saved about sleeping better?";
const ASK_ANSWER =
  "With your marathon training in mind: keep a fixed wake-up time, even after long runs, and no caffeine after noon. Three of your overviews agree.";
const ASK_CITES: readonly { icon: StrokeIconName; title: string }[] = [
  { icon: "headphones", title: "Sleep, caffeine and the afternoon slump" },
  { icon: "fileText", title: "Why your wake-up time matters more than bedtime" },
  { icon: "play", title: "The sleep protocol that changed my life" },
];
const FIND_LABEL = "Find it again";
const FIND_QUERY = "that crispy chicken dinner";
const FIND_RESULTS: readonly { icon: StrokeIconName; title: string; why: string }[] = [
  { icon: "chefHat", title: "One-pan chicken thighs with lemon and butter beans", why: "Recipe · matched by meaning" },
  { icon: "fileText", title: "The 20-minute weeknight dinner formula", why: "Article · also about quick dinners" },
];
const CONTINUE = "Continue";

export interface OnboardingKnowledgeMomentProps {
  onContinue: () => void;
  onSkip: () => void;
}

export const OnboardingKnowledgeMoment = ({ onContinue, onSkip }: OnboardingKnowledgeMomentProps) => {
  const isPanel = useIsPanel();
  return (
    <div className={styles.root} data-testid={onboardingKnowledgeMomentTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading>{HEADING}</OnboardingHeading>
        {!isPanel && <p className={styles.lead}>{LEAD}</p>}
      </div>

      <div className={styles.cards}>
        <figure className={styles.card} aria-label={`An example: ${ASK_LABEL}`}>
          <figcaption className={styles.label}>
            <StrokeIcon name="chat" size={12} />
            {ASK_LABEL}
          </figcaption>
          <p className={styles.question}>{ASK_QUESTION}</p>
          <p className={styles.answer}>{ASK_ANSWER}</p>
          <ul className={styles.cites}>
            {ASK_CITES.map((cite) => (
              <li key={cite.title} className={styles.cite}>
                <StrokeIcon name={cite.icon} size={11} />
                <span className={styles.citeTitle}>{cite.title}</span>
              </li>
            ))}
          </ul>
        </figure>

        <figure className={styles.card} aria-label={`An example: ${FIND_LABEL}`}>
          <figcaption className={styles.label}>
            <StrokeIcon name="search" size={12} />
            {FIND_LABEL}
          </figcaption>
          <p className={styles.query}>
            <StrokeIcon name="search" size={15} />
            {FIND_QUERY}
          </p>
          <ul className={styles.results}>
            {FIND_RESULTS.map((result) => (
              <li key={result.title} className={styles.result}>
                <span className={styles.tile}>
                  <StrokeIcon name={result.icon} size={12} />
                </span>
                <span className={styles.resultText}>
                  <span className={styles.resultTitle}>{result.title}</span>
                  <span className={styles.resultWhy}>{result.why}</span>
                </span>
              </li>
            ))}
          </ul>
        </figure>
      </div>

      <div className={styles.foot}>
        <button type="button" className={styles.primary} onClick={onContinue} data-testid={onboardingKnowledgeMomentTestIds.next}>
          {CONTINUE}
        </button>
        <button type="button" className={styles.quiet} onClick={onSkip} data-testid={onboardingPageTestIds.skip}>
          Skip
        </button>
      </div>
    </div>
  );
};
