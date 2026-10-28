import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import styles from "./SignedOutGate.module.scss";
import { signedOutGateTestIds } from "./SignedOutGateTestIds.js";

// Signed out where there are accounts, in place of every page that shows overviews: none is
// seen without an account (docs/architecture/tiers.md, "Signed out"; design 46q in the panel).
export function SignedOutGate({ panel = false }: { panel?: boolean }) {
  const heading = useRef<HTMLHeadingElement | null>(null);
  const analytics = useAnalytics();

  useEffect(() => heading.current?.focus(), []);

  return (
    <div className={`${styles.root} ${panel ? styles.panel : ""}`} data-testid={signedOutGateTestIds.root}>
      <h1 className={styles.title} ref={heading} tabIndex={-1}>
        Your overviews need an account
      </h1>
      <p className={styles.lead}>
        Sign in to read the overviews you've made, or create a free account to make your first.
      </p>
      <div className={styles.actions}>
        <Link
          className={styles.createAccount}
          to={Routes.createAccount()}
          onClick={() => analytics.account.signedOutGate.chosen({ way: "createAccount" })}
          data-testid={signedOutGateTestIds.createAccount}
        >
          Create an account
        </Link>
        <Link
          className={styles.signIn}
          to={Routes.signIn()}
          onClick={() => analytics.account.signedOutGate.chosen({ way: "signIn" })}
          data-testid={signedOutGateTestIds.signIn}
        >
          <StrokeIcon name="signIn" size={17} />
          Sign in
        </Link>
      </div>
    </div>
  );
}
