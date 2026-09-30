import type { Ref } from "react";
import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { OverviewMark } from "../../../../components/shared/OverviewMark/OverviewMark.js";
import styles from "./SharedPageHeader.module.scss";
import { sharedPageHeaderTestIds } from "./SharedPageHeaderTestIds.js";

// Design 30e: the shared page's own head. None of the app's chrome, because a visitor has
// no library behind them — just the way in. It stays put as the page scrolls, the way the
// app's own masthead does, and the tab strip rests against its measured height
// (docs/features/sharing.md).
export function SharedPageHeader({ ref }: { ref?: Ref<HTMLElement> }) {
  return (
    <header className={styles.root} ref={ref} data-testid={sharedPageHeaderTestIds.root}>
      <Link className={styles.home} to={Routes.home()} data-testid={sharedPageHeaderTestIds.home}>
        <OverviewMark size={22} />
        <span className={styles.wordmark}>The Overview</span>
      </Link>
      <span className={styles.actions}>
        <Link className={styles.quietAction} to={Routes.signIn()} data-testid={sharedPageHeaderTestIds.signInButton}>
          Sign in
        </Link>
        <Link
          className={styles.action}
          to={Routes.createAccount()}
          data-testid={sharedPageHeaderTestIds.makeButton}
        >
          Make an overview
        </Link>
      </span>
    </header>
  );
}
