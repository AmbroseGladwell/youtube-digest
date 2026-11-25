import { useRef, useState } from "react";
import { overviewQuotas } from "@overview/domain";
import { FloatingTip } from "../../../../components/shared/FloatingTip/FloatingTip.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useMediaQuery } from "../../../../util/useMediaQuery.js";
import { usePlanPrompt } from "../../usePlanPrompt.js";
import { PlansModal } from "../PlansModal/PlansModal.js";
import styles from "./GetPlusButton.module.scss";
import { getPlusButtonTestIds } from "./GetPlusButtonTestIds.js";

export const GET_OVERVIEW_PLUS = "Get Overview Plus";
export const PLUS_ON_US_LINE = `${overviewQuotas.plus.ours} overviews a month on us`;

const WIDE_BAR = "(min-width: 62rem)";

// Free only, on a wide top bar; it drops to the account menu where there's no room (design 351a).
export const GetPlusButton = () => (useMediaQuery(WIDE_BAR) ? <GetPlusOnTheBar /> : null);

const GetPlusOnTheBar = () => {
  const { prompt, plan, chose } = usePlanPrompt({ kind: "pill" });
  const [plansOpen, setPlansOpen] = useState(false);
  const [tipShown, setTipShown] = useState(false);
  const button = useRef<HTMLButtonElement | null>(null);

  if (prompt === null) {
    return null;
  }
  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-label={`${GET_OVERVIEW_PLUS}: see plans`}
        aria-haspopup="dialog"
        onClick={() => {
          chose("seePlans");
          setPlansOpen(true);
        }}
        onPointerEnter={() => setTipShown(true)}
        onPointerLeave={() => setTipShown(false)}
        onFocus={() => setTipShown(true)}
        onBlur={() => setTipShown(false)}
        data-testid={getPlusButtonTestIds.button}
      >
        <StrokeIcon name="gem" size={17} weight={1.8} />
        {GET_OVERVIEW_PLUS}
      </button>
      <FloatingTip text={PLUS_ON_US_LINE} shown={tipShown && !plansOpen} anchor={button} />
      <PlansModal open={plansOpen} plan={plan} onClose={() => setPlansOpen(false)} />
    </>
  );
};
