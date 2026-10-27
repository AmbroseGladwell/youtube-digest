import { Fragment } from "react";
import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { useOverviewUsageQuery } from "../../queries/overviewUsageQuery.js";
import { useNextQuota } from "../../useNextQuota.js";
import { usageLineOf } from "../../util/usageLine.js";
import styles from "./UsageLine.module.scss";
import type { UsageLineTestIds } from "./UsageLineTestIds.js";

export interface UsageLineProps {
  testIds: UsageLineTestIds;
  // The extension panel's capture screen, where the line drops the Plan link unless it has a
  // plan to mention (designs 95c, 95m).
  narrow?: boolean;
  onPlanFollowed?: () => void;
}

// What's left of the quota the next overview will use, in words (designs 95b, 95c and 95m).
export function UsageLine({ testIds, narrow = false, onPlanFollowed }: UsageLineProps) {
  const next = useNextQuota();
  const plan = useOverviewUsageQuery().data?.plan ?? null;
  if (next === null) return null;
  const { parts, link } = usageLineOf(next, { narrow, plan });
  const segments = [
    ...parts,
    ...(link !== null
      ? [
          <Link
            key="plan"
            className={styles.planLink}
            to={Routes.settingsSection("plan")}
            onClick={onPlanFollowed}
            data-testid={testIds.planLink}
          >
            {link}
          </Link>,
        ]
      : []),
  ];

  return (
    <p className={styles.root} data-testid={testIds.root}>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {index > 0 && <span aria-hidden="true">{" · "}</span>}
          {segment}
        </Fragment>
      ))}
    </p>
  );
}
