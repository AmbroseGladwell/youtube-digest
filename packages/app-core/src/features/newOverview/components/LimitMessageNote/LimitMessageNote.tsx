import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { DEFAULT_PLAN } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useOverviewUsageQuery } from "../../queries/overviewUsageQuery.js";
import { LIMIT_ACTION_LABEL, LIMIT_FOOT, type LimitAction, type LimitMessage } from "../../util/limitMessage.js";
import styles from "./LimitMessageNote.module.scss";
import type { LimitMessageNoteTestIds } from "./LimitMessageNoteTestIds.js";

export interface LimitMessageNoteProps {
  message: LimitMessage;
  from: "dialog" | "home" | "panel";
  testIds: LimitMessageNoteTestIds;
  // Whether the message has just come into view, and so takes focus to its first action
  // (design 95i): the dialog as it opens.
  takeFocus?: boolean;
  onFollowed?: () => void;
}

const ROUTE: Record<LimitAction, () => string> = {
  createAccount: () => Routes.createAccount(),
  addKey: () => Routes.settingsSection("keys"),
  seePlans: () => Routes.settingsSection("plan"),
  seeByoPlus: () => Routes.settingsSection("plan"),
  seeUsage: () => Routes.settingsSection("plan"),
};

const WAY = { createAccount: "createAccount", addKey: "addKey", seePlans: "seePlans", seeByoPlus: "seePlans", seeUsage: "seePlans" } as const;

// What ran out, when it's back and the ways round it, in Generate's place (designs 95i–95o).
// The link stays in the field, so a reader who adds a key carries on where they were.
export function LimitMessageNote({ message, from, testIds, takeFocus = false, onFollowed }: LimitMessageNoteProps) {
  const analytics = useAnalytics();
  const plan = useOverviewUsageQuery().data?.plan ?? DEFAULT_PLAN;
  const firstAction = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    analytics.capture.limitMessage.shown({ quota: message.quota, plan: message.quota === "trial" ? "signedOut" : plan, from });
  }, [message.quota]);

  useEffect(() => {
    if (!takeFocus) return;
    const frame = requestAnimationFrame(() => firstAction.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [takeFocus, message.quota]);

  const follow = (action: LimitAction) => {
    analytics.capture.limitMessage.wayChosen({ way: WAY[action], from });
    if (action === "createAccount" && message.quota === "trial") analytics.account.trial.createAccountChosen({ from });
    onFollowed?.();
  };

  return (
    <div className={styles.root} data-testid={testIds.root}>
      <div role="status">
        <p className={styles.title} data-testid={testIds.title}>
          {message.title}
        </p>
        <p className={styles.body} data-testid={testIds.body}>
          {message.body}
        </p>
      </div>
      <div className={styles.actions}>
        {message.actions.map((action, index) => (
          <Link
            key={action}
            ref={index === 0 ? firstAction : undefined}
            className={index === 0 ? styles.primary : styles.secondary}
            to={ROUTE[action]()}
            onClick={() => follow(action)}
            data-testid={testIds.action(action)}
          >
            {LIMIT_ACTION_LABEL[action]}
          </Link>
        ))}
      </div>
      <p className={styles.foot} data-testid={testIds.foot}>
        {LIMIT_FOOT}
      </p>
    </div>
  );
}
