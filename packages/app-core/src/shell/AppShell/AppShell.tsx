import { Outlet } from "react-router";
import styles from "./AppShell.module.scss";
import { appShellTestIds } from "./AppShellTestIds.js";

export function AppShell() {
  return (
    <div className={styles.root} data-testid={appShellTestIds.root}>
      <header className={styles.masthead} data-testid={appShellTestIds.masthead}>
        <span className={styles.brand}>
          <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true" className={styles.mark}>
            <circle cx="16" cy="14.5" r="7.5" fill="none" stroke="currentColor" strokeWidth="3" />
            <rect x="7" y="25" width="18" height="2.5" fill="currentColor" />
          </svg>
          <h1 className={styles.title}>The Overview</h1>
        </span>
        <nav className={styles.nav} aria-label="Sections">
          <span className={styles.navCurrent} aria-current="page">
            Overviews
          </span>
        </nav>
      </header>
      <div className={styles.pane} data-testid={appShellTestIds.pane}>
        <Outlet />
      </div>
    </div>
  );
}
