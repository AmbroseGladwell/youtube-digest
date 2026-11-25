import { useState } from "react";
import type { Plan } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { resetDate } from "../../../newOverview/util/usageLine.js";
import { LimitInPlace } from "../../../plus/components/LimitInPlace/LimitInPlace.js";
import { PlansModal } from "../../../plus/components/PlansModal/PlansModal.js";
import { usePlanPrompt } from "../../../plus/usePlanPrompt.js";
import { limitCopy } from "../../../plus/util/limitCopy.js";
import styles from "./ChatMonthLimit.module.scss";
import { chatMonthLimitTestIds } from "./ChatMonthLimitTestIds.js";

export interface ChatMonthLimitProps {
  plan: Plan;
  resetsOn: string;
  onPlansFollowed: () => void;
}

// Design 351h: the month's questions used, in the composer's place; Not now folds it to one line until tomorrow.
export const ChatMonthLimit = ({ plan, resetsOn, onPlansFollowed }: ChatMonthLimitProps) => {
  const { prompt, chose, putAway } = usePlanPrompt({ kind: "chat" });
  const [plansOpen, setPlansOpen] = useState(false);
  const back = resetDate(resetsOn);
  const seePlans = () => {
    chose("seePlans");
    onPlansFollowed();
    setPlansOpen(true);
  };

  return (
    <>
      {prompt === null ? (
        <div className={styles.folded} data-testid={chatMonthLimitTestIds.folded}>
          <div className={styles.field} aria-disabled="true" data-testid={chatMonthLimitTestIds.foldedField}>
            <StrokeIcon name="chat" size={16} />
            <span>Asking is back on {back}</span>
            <span className={styles.send} aria-hidden="true">
              <StrokeIcon name="arrowUp" size={16} />
            </span>
          </div>
          <p className={styles.line}>
            <StrokeIcon name="gem" size={14} weight={1.8} />
            Questions are back on {back}.
            {plan !== "plus" && (
              <button type="button" className={styles.link} onClick={seePlans} data-testid={chatMonthLimitTestIds.seePlans}>
                See plans
              </button>
            )}
          </p>
        </div>
      ) : (
        <LimitInPlace {...limitCopy.chat(plan, resetsOn)} onGetPlus={seePlans} onNotNow={putAway} />
      )}
      <PlansModal open={plansOpen} plan={plan} onClose={() => setPlansOpen(false)} />
    </>
  );
};
