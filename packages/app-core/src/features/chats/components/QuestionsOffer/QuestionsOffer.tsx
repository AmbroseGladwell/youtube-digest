import { useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { PlansModal } from "../../../plus/components/PlansModal/PlansModal.js";
import { usePlanPrompt } from "../../../plus/usePlanPrompt.js";
import styles from "./QuestionsOffer.module.scss";
import { questionsOfferTestIds } from "./QuestionsOfferTestIds.js";

export interface QuestionsOfferProps {
  scope: "library" | "project";
}

const HEADING_ID = "questions-offer-heading";

// Design 351f: suggested questions are the one thing a paid plan adds, offered where a Free reader's own would be.
export const QuestionsOffer = ({ scope }: QuestionsOfferProps) => {
  const { prompt, plan, chose, putAway } = usePlanPrompt({ kind: "questions" });
  const [plansOpen, setPlansOpen] = useState(false);
  if (prompt === null && !plansOpen) {
    return null;
  }
  return (
    <>
      {prompt !== null && (
        <div className={styles.root} role="group" aria-labelledby={HEADING_ID} data-testid={questionsOfferTestIds.root}>
          <p className={styles.heading} id={HEADING_ID}>
            <StrokeIcon name="gem" size={17} weight={1.8} />
            Uncover connections you’d have missed
          </p>
          <p className={styles.body}>
            We look across {scope === "project" ? "this project’s overviews" : "your saved overviews"} for links and differing views, then
            suggest questions personalised to you.
          </p>
          <div className={styles.foot}>
            <button
              type="button"
              className={styles.unlock}
              onClick={() => {
                chose("seePlans");
                setPlansOpen(true);
              }}
              data-testid={questionsOfferTestIds.unlock}
            >
              Unlock with a paid plan
            </button>
            <button
              type="button"
              className={styles.notNow}
              aria-label="Not now: hide this until tomorrow"
              onClick={putAway}
              data-testid={questionsOfferTestIds.notNow}
            >
              Not now
            </button>
          </div>
        </div>
      )}
      <PlansModal open={plansOpen} plan={plan} onClose={() => setPlansOpen(false)} />
    </>
  );
};
