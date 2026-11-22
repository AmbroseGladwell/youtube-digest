import { useEffect, useRef } from "react";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import styles from "./SignedOutGate.module.scss";
import { signedOutGateTestIds } from "./SignedOutGateTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

export const SignedOutGate = ({ panel = false }: { panel?: boolean }) => {
  const heading = useRef<HTMLHeadingElement | null>(null);
  const analytics = useAnalytics();

  useEffect(() => heading.current?.focus(), []);

  const createAccount = (
    <PageLink
      className={panel ? styles.signIn : styles.createAccount}
      to={Routes.createAccount()}
      onClick={() => analytics.account.signedOutGate.chosen({ way: "createAccount" })}
      data-testid={signedOutGateTestIds.createAccount}
    >
      Create an account
    </PageLink>
  );
  const signIn = (
    <PageLink
      className={panel ? styles.createAccount : styles.signIn}
      to={Routes.signIn()}
      onClick={() => analytics.account.signedOutGate.chosen({ way: "signIn" })}
      data-testid={signedOutGateTestIds.signIn}
    >
      <StrokeIcon name="signIn" size={17} />
      Sign in
    </PageLink>
  );

  return (
    <div className={`${styles.root} ${panel ? styles.panel : ""}`} data-testid={signedOutGateTestIds.root}>
      <h1 className={styles.title} ref={heading} tabIndex={-1}>
        {panel ? "Sign in to see your overviews" : "Your overviews need an account"}
      </h1>
      <p className={styles.lead}>
        {panel
          ? "Your overviews are kept in your account. Sign in to read them, listen to them and make more."
          : "Sign in to read the overviews you've made, or create a free account to make your first."}
      </p>
      <div className={styles.actions}>
        {panel ? (
          <>
            {signIn}
            {createAccount}
          </>
        ) : (
          <>
            {createAccount}
            {signIn}
          </>
        )}
      </div>
    </div>
  );
};
