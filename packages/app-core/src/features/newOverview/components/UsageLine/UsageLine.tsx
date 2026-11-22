import { Fragment } from "react";
import { Routes } from "../../../../app/Routes.js";
import { useOverviewUsageQuery } from "../../queries/overviewUsageQuery.js";
import { useNextQuota } from "../../useNextQuota.js";
import { usageLineOf } from "../../util/usageLine.js";
import styles from "./UsageLine.module.scss";
import type { UsageLineTestIds } from "./UsageLineTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

export interface UsageLineProps {
  testIds: UsageLineTestIds;
  // The panel's capture screen, which drops the Plan link unless it has a plan to mention.
  narrow?: boolean;
  onPlanFollowed?: () => void;
}

export const UsageLine = ({ testIds, narrow = false, onPlanFollowed }: UsageLineProps) => {
  const next = useNextQuota();
  const plan = useOverviewUsageQuery().data?.plan ?? null;
  if (next === null) {
    return null;
  }
  const { parts, link } = usageLineOf(next, { narrow, plan });
  const segments = [
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
};
