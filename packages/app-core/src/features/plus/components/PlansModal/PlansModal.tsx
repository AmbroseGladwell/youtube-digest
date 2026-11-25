import { useEffect, useState } from "react";
import type { Plan } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { BottomSheet, NARROW_SHEET_WIDTH } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import type { Billing, PaidPlan } from "../../planCards.js";
import { PLAN_LABEL } from "../../planLabel.js";
import { useToldWhen } from "../../useToldWhen.js";
import { BillingSwitch } from "../BillingSwitch/BillingSwitch.js";
import { PlanOfferCard } from "../PlanOfferCard/PlanOfferCard.js";
import styles from "./PlansModal.module.scss";
import { plansModalTestIds } from "./PlansModalTestIds.js";

export interface PlansModalProps {
  open: boolean;
  plan: Plan;
  onClose: () => void;
  // For an opener that is gone once the modal is open, like an item in a closed menu.
  returnFocusTo?: HTMLElement | null | undefined;
}

const PAID_FOR: Record<Plan, PaidPlan[]> = { free: ["byo-plus", "plus"], "byo-plus": ["plus"], plus: [] };

// Outside Settings, every See plans opens the paid plans only (design 351m); a phone gets the full height, Plus first.
export const PlansModal = ({ open, plan, onClose, returnFocusTo }: PlansModalProps) => {
  const analytics = useAnalytics();
  const phone = useIsPhone();
  const [billing, setBilling] = useState<Billing>("yearly");
  const { told, tell } = useToldWhen();
  const byo = plan === "byo-plus";
  const offered = phone ? [...PAID_FOR[plan]].reverse() : PAID_FOR[plan];
  const title = byo ? "Get more with Plus" : "Get more from your library";

  useEffect(() => {
    if (open) {
      analytics.plus.prompt.shown({ variant: "modal", plan });
    }
  }, [open]);

  return (
    <BottomSheet
      open={open}
      title={title}
      onClose={onClose}
      closeLabel="Close plans"
      wide="dialog"
      width={byo ? NARROW_SHEET_WIDTH : "47.5rem"}
      startsFull
      returnFocusTo={returnFocusTo}
      testId={plansModalTestIds.root}
      head={<h2 className={styles.title}>{title}</h2>}
    >
      <div className={styles.content}>
        <p className={styles.lead}>
          {byo ? "You’re on BYO Plus. Plus adds the most on us." : "You’re on Free. Both plans include everything in Free."} Paid plans are
          coming soon.
        </p>
        <BillingSwitch billing={billing} onChange={setBilling} testId={plansModalTestIds.billing} />
        <ul className={`${styles.cards} ${offered.length === 1 ? styles.one : ""}`}>
          {offered.map((paid) => (
            <PlanOfferCard
              key={paid}
              plan={paid}
              billing={billing}
              yours={false}
              offered
              told={told.includes(paid)}
              onTell={(chosen) => {
                tell(chosen);
                analytics.plus.prompt.chosen({ variant: "modal", plan, outcome: "tellMeWhen", tellMeWhen: chosen });
              }}
            />
          ))}
        </ul>
        <p className={styles.foot}>
          *Question counts are typical, not fixed. Yearly is billed once a year. Prices in GBP.{" "}
          <PageLink to={Routes.settingsSection("plan")} onClick={onClose} className={styles.link} data-testid={plansModalTestIds.compare}>
            Compare all plans in Settings
          </PageLink>
        </p>
        <p className={styles.announce} role="status">
          {told.length > 0 ? `You’re on the list for ${told.map((paid) => PLAN_LABEL[paid]).join(" and ")}.` : ""}
        </p>
      </div>
    </BottomSheet>
  );
};
