import { useState } from "react";
import type { Plan } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useNextQuota } from "../../../newOverview/useNextQuota.js";
import { CHECKING } from "../../../newOverview/util/usageLine.js";
import type { NextQuota } from "../../../newOverview/util/nextQuota.js";
import { PLAN_LABEL } from "../../planLabel.js";
import type { Billing, PaidPlan } from "../../planCards.js";
import { usePlan } from "../../usePlan.js";
import { usePlanUsage } from "../../usePlanUsage.js";
import { useToldWhen } from "../../useToldWhen.js";
import { BillingSwitch } from "../BillingSwitch/BillingSwitch.js";
import { PlanOfferCard } from "../PlanOfferCard/PlanOfferCard.js";
import styles from "./PlusPlanPanel.module.scss";
import { plusPlanPanelTestIds } from "./PlusPlanPanelTestIds.js";

const PLANS: Plan[] = ["free", "byo-plus", "plus"];

const ON_KEY = { ours: "on us", own: "on your own key" } as const;

export const PLAN_FOOTNOTE =
  "*Question counts are typical, not fixed: questions across your whole library use more than questions about one overview. Transcribing counts each episode’s length. Allowances reset on the 1st of each month. Yearly is billed once a year: 17% less than monthly on BYO Plus, 16% less on Plus. Prices are in GBP; plans and prices may change, and we’ll tell you before they do.";

const summaryOf = (next: NextQuota | null): string | null => {
  switch (next?.kind) {
    case "quota":
      return `${next.left} of ${next.limit} overviews ${ON_KEY[next.key]} left`;
    case "spent":
      return "No overviews left";
    case "checking":
      return CHECKING;
    default:
      return null;
  }
};

const offeredTo = (plan: Plan, card: Plan): boolean => PLANS.indexOf(card) > PLANS.indexOf(plan);

// Settings › Plan is for choosing: the plan, one usage line, then every plan's card (design 351j).
export const PlusPlanPanel = () => {
  const { plan, status, recheck } = usePlan();
  const usage = usePlanUsage();
  const next = useNextQuota();
  const analytics = useAnalytics();
  const [billing, setBilling] = useState<Billing>("yearly");
  const { told, tell } = useToldWhen();

  if (status !== "known") {
    return (
      <section className={styles.root} aria-busy={status === "checking"} data-testid={plusPlanPanelTestIds.root}>
        <p className={styles.eyebrow}>Your plan</p>
        <p className={styles.planName} data-testid={plusPlanPanelTestIds.planName}>
          {status === "checking" ? "Checking…" : "Couldn't check your plan"}
        </p>
        {status === "unreachable" && (
          <p className={styles.note}>
            Your plan is kept with your account, and the server didn't answer.{" "}
            <button
              type="button"
              className={styles.recheck}
              onClick={() => {
                analytics.plus.planPanel.recheckChosen();
                recheck();
              }}
              data-testid={plusPlanPanelTestIds.recheckButton}
            >
              Try again
            </button>
          </p>
        )}
      </section>
    );
  }

  const signedOut = usage?.signedIn === false;
  const summary = signedOut ? null : summaryOf(next);

  return (
    <section className={styles.root} data-testid={plusPlanPanelTestIds.root}>
      <div className={styles.yourPlan}>
        <p className={styles.eyebrow}>{signedOut ? "Signed out" : "Your plan"}</p>
        <p className={styles.planName} data-testid={plusPlanPanelTestIds.planName}>
          {signedOut ? "No account" : PLAN_LABEL[plan]}
        </p>
      </div>
      {signedOut && (
        <p className={styles.summary}>
          Plans come with an account.{" "}
          <PageLink className={styles.link} to={Routes.createAccount()} data-testid={plusPlanPanelTestIds.createAccountLink}>
            Create account
          </PageLink>
        </p>
      )}
      {summary !== null && (
        <p className={styles.summary} data-testid={plusPlanPanelTestIds.summary}>
          This month: <b>{summary}</b> ·{" "}
          <PageLink className={styles.link} to={Routes.settingsSection("usage")} data-testid={plusPlanPanelTestIds.seeUsageLink}>
            See usage
          </PageLink>
        </p>
      )}
      <BillingSwitch billing={billing} onChange={setBilling} testId={plusPlanPanelTestIds.billing} />
      <ul className={styles.plans}>
        {PLANS.map((card) => (
          <PlanOfferCard
            key={card}
            plan={card}
            billing={billing}
            yours={!signedOut && card === plan}
            offered={offeredTo(plan, card)}
            told={card !== "free" && told.includes(card)}
            onTell={(chosen: PaidPlan) => {
              tell(chosen);
              analytics.plus.prompt.chosen({ variant: "settings", plan, outcome: "tellMeWhen", tellMeWhen: chosen });
            }}
          />
        ))}
      </ul>
      <p className={styles.foot}>{PLAN_FOOTNOTE}</p>
      <p className={styles.announce} role="status">
        {told.length > 0 ? `You’re on the list for ${told.map((paid) => PLAN_LABEL[paid]).join(" and ")}.` : ""}
      </p>
    </section>
  );
};
