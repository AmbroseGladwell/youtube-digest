import { Outlet } from "react-router";
import styles from "./AppShell.module.scss";
import { appShellTestIds } from "./AppShellTestIds.js";

export function AppShell() {
  return (
    <div className={styles.root} data-testid={appShellTestIds.root}>
      <header className={styles.masthead} data-testid={appShellTestIds.masthead}>
        <div className={styles.mastheadInner}>
          <h1 className={styles.title}>The Overview</h1>
          <p className={styles.standfirst}>
            Paste a YouTube link. Get a blunt verdict, not a summary.
          </p>
        </div>
      </header>
      <div className={styles.pane} data-testid={appShellTestIds.pane}>
        <Outlet />
      </div>
    </div>
  );
}
