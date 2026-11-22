import type { Ref } from "react";
import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { OverviewMark } from "../../../../components/shared/OverviewMark/OverviewMark.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useSharedPageReader } from "../../useSharedPageReader.js";
import styles from "./SharedPageHeader.module.scss";
import { sharedPageHeaderTestIds } from "./SharedPageHeaderTestIds.js";

// None of the app's chrome, because a visitor has no library behind them.
export const SharedPageHeader = ({ ref }: { ref?: Ref<HTMLElement> }) => {
  const analytics = useAnalytics();
  const { signedIn } = useSharedPageReader();

  return (
    <header className={styles.root} ref={ref} data-sticky-fade="" data-testid={sharedPageHeaderTestIds.root}>
      <Link
        className={styles.home}
        to={Routes.home()}
        onClick={() => analytics.sharedPage.header.homeChosen()}
        data-testid={sharedPageHeaderTestIds.home}
      >
        <OverviewMark size={22} />
        <span className={styles.wordmark}>The Overview</span>
      </Link>
      <span className={styles.actions}>
        {signedIn ? (
          <Link
            className={styles.action}
            to={Routes.home()}
            onClick={() => analytics.sharedPage.header.libraryChosen()}
            data-testid={sharedPageHeaderTestIds.libraryButton}
          >
            Your overviews
          </Link>
        ) : (
          <>
            <Link
              className={styles.quietAction}
              to={Routes.signIn()}
              onClick={() => analytics.sharedPage.header.signInChosen()}
              data-testid={sharedPageHeaderTestIds.signInButton}
            >
              Sign in
            </Link>
            <Link
              className={styles.action}
              to={Routes.home()}
              onClick={() => analytics.sharedPage.header.makeChosen()}
              data-testid={sharedPageHeaderTestIds.makeButton}
            >
              Make an overview
            </Link>
          </>
        )}
      </span>
    </header>
  );
};
