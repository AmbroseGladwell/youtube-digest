import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useChatUsageQuery } from "../../../chats/queries/chatUsageQuery.js";
import { PLAN_LABEL } from "../../planLabel.js";
import { usePlan } from "../../usePlan.js";
import { usePlanUsage } from "../../usePlanUsage.js";
import { PlanUsage } from "../PlanUsage/PlanUsage.js";
import styles from "./UsagePanel.module.scss";
import { usagePanelTestIds } from "./UsagePanelTestIds.js";

// Settings › Usage: this month in full, apart from the plans (design 351j-5).
export const UsagePanel = () => {
  const { plan, status } = usePlan();
  const usage = usePlanUsage();
  const chatUsage = useChatUsageQuery().data ?? null;

  if (usage === null) {
    return null;
  }
  return (
    <section className={styles.root} data-testid={usagePanelTestIds.root}>
      {usage.signedIn && status === "known" && (
        <div className={styles.head}>
          <p className={styles.yourPlan} data-testid={usagePanelTestIds.yourPlan}>
            Your plan: <b>{PLAN_LABEL[plan]}</b>
          </p>
          {plan !== "plus" && (
            <PageLink
              className={styles.upgrade}
              to={Routes.settingsSection("plan")}
              aria-label="Upgrade plan: see the plans"
              data-testid={usagePanelTestIds.upgrade}
            >
              <StrokeIcon name="gem" size={15} weight={1.8} />
              Upgrade plan
            </PageLink>
          )}
        </div>
      )}
      {usage.signedIn ? <PlanUsage {...usage} chatUsage={chatUsage} /> : <PlanUsage {...usage} />}
    </section>
  );
};
