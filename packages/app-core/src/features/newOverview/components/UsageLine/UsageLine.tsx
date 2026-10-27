import { Fragment } from "react";
import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { useNextQuota } from "../../useNextQuota.js";
import { usageLineOf } from "../../util/usageLine.js";
import styles from "./UsageLine.module.scss";
import type { UsageLineTestIds } from "./UsageLineTestIds.js";

export interface UsageLineProps {
  testIds: UsageLineTestIds;
  // The extension panel's capture screen, where the line drops the Plan link (design 95c).
  narrow?: boolean;
  onPlanFollowed?: () => void;
}

// What's left of the quota the next overview will use, in words (designs 95b and 95c).
export function UsageLine({ testIds, narrow = false, onPlanFollowed }: UsageLineProps) {
  const next = useNextQuota();
  if (next === null) return null;
  const { parts, planLink } = usageLineOf(next, narrow);
  const segments = [
    ...parts,
    ...(planLink
      ? [
          <Link
            key="plan"
            className={styles.planLink}
            to={Routes.settingsSection("plan")}
            onClick={onPlanFollowed}
            data-testid={testIds.planLink}
          >
            Plan
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
