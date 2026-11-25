import { Fragment, useState, type ReactNode } from "react";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { PlansModal } from "../../../plus/components/PlansModal/PlansModal.js";
import { usePlanPrompt } from "../../../plus/usePlanPrompt.js";
import { useOverviewUsageQuery } from "../../queries/overviewUsageQuery.js";
import { useNextQuota } from "../../useNextQuota.js";
import { monthBefore, resetDate, usageLineOf } from "../../util/usageLine.js";
import styles from "./UsageLine.module.scss";
import type { UsageLineTestIds } from "./UsageLineTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

export interface UsageLineProps {
  testIds: UsageLineTestIds;
  // The panel's capture screen, which drops the Plan link unless it has a plan to mention.
  narrow?: boolean;
  // Where the reader is about to make one: Create and the panel. Elsewhere the line counts, offers nothing once-only and records nothing.
  offersPlus?: boolean;
  onPlanFollowed?: () => void;
}

const joined = (segments: ReactNode[]) =>
  segments.map((segment, index) => (
    <Fragment key={index}>
      {index > 0 && <span aria-hidden="true">{" · "}</span>}
      {segment}
    </Fragment>
  ));

// Free and BYO Plus count overviews on us down here, and meet the reset line once after a month at the limit (351c, 351d).
export const UsageLine = ({ testIds, narrow = false, offersPlus = false, onPlanFollowed }: UsageLineProps) => {
  const next = useNextQuota();
  const usage = useOverviewUsageQuery().data ?? null;
  const quiet = !offersPlus;
  const reset = usePlanPrompt({ kind: "reset" }, { quiet });
  const counter = usePlanPrompt({ kind: "counter", next }, { quiet });
  const [plansOpen, setPlansOpen] = useState(false);

  if (next === null) {
    return null;
  }

  const seePlans = (chose: () => void) => (
    <button
      key="plans"
      type="button"
      className={styles.plansLink}
      onClick={() => {
        chose();
        setPlansOpen(true);
      }}
      data-testid={testIds.seePlans}
    >
      See plans
    </button>
  );
  const plans = <PlansModal open={plansOpen} plan={counter.plan} onClose={() => setPlansOpen(false)} />;

  if (!quiet && reset.prompt?.variant === "reset" && usage !== null) {
    return (
      <p className={`${styles.root} ${styles.offer}`} data-testid={testIds.root}>
        <StrokeIcon name="gem" size={14} weight={1.8} />
        <b>
          Your {reset.prompt.limit} are back for {monthBefore(usage.resetsOn)}.
        </b>{" "}
        Make more with Plus <span aria-hidden="true">·</span> {seePlans(() => reset.chose("seePlans"))}
        {plans}
      </p>
    );
  }

  const shown = counter.prompt;
  if (shown?.variant === "counter" || shown?.variant === "nudge") {
    const left = `${shown.left} of ${shown.limit} ${counter.plan === "free" ? "" : "on us "}left this month`;
    return (
      <p className={`${styles.root} ${styles.offer}`} data-testid={testIds.root}>
        {joined([
          <b key="left">{left}</b>,
          `More on ${resetDate(shown.resetsOn)}`,
          ...(shown.variant === "nudge" ? [seePlans(() => counter.chose("seePlans"))] : []),
        ])}
        {plans}
      </p>
    );
  }

  const { parts, link } = usageLineOf(next, { narrow, plan: usage?.plan ?? null });
  return (
    <p className={styles.root} data-testid={testIds.root}>
      {joined([
        ...parts,
        ...(link !== null
          ? [
              <PageLink
                key="plan"
                className={styles.planLink}
                to={Routes.settingsSection("plan")}
                onClick={onPlanFollowed}
                data-testid={testIds.planLink}
              >
                {link}
              </PageLink>,
            ]
          : []),
      ])}
    </p>
  );
};
