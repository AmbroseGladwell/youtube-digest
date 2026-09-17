import { useLayoutEffect, useRef } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from "react-router";
import type { Overview } from "@overview/types";
import { Routes } from "../../app/Routes.js";
import { GenerationStatusStrip } from "../../features/newOverview/components/GenerationStatusStrip/GenerationStatusStrip.js";
import { NewOverviewDialog } from "../../features/newOverview/components/NewOverviewDialog/NewOverviewDialog.js";
import { useNewOverviewRun } from "../../features/newOverview/useNewOverviewRun.js";
import { useMeasuredHeight } from "../../util/useMeasuredHeight.js";
import {
  navigationDirection,
  shouldAnimateNavigation,
  useShouldAnimateNavigation,
} from "../../util/viewTransitions.js";
import styles from "./AppShell.module.scss";
import "./paneTransitions.scss";
import { appShellTestIds } from "./AppShellTestIds.js";

const MASTHEAD_HEIGHT_PROPERTY = "--masthead-height";

export function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mastheadHeight = useMeasuredHeight(MASTHEAD_HEIGHT_PROPERTY);
  const animateNavigation = useShouldAnimateNavigation();

  // paneTransitions.scss keys the way in and the way back off this, and it has to be on
  // the root: ::view-transition-* pseudo-elements can't see an attribute further down. A
  // layout effect lands it inside the router's own DOM update, which is the moment the
  // browser takes the "after" snapshot.
  const previousPathname = useRef(pathname);
  useLayoutEffect(() => {
    document.documentElement.dataset.navDirection = navigationDirection(
      previousPathname.current,
      pathname,
    );
    previousPathname.current = pathname;
  }, [pathname]);

  // The shell is the one component that survives every navigation, so the run it owns can
  // outlive both the dialog it was started from and the page it was started on
  // (docs/features/overview-redesign.md, "Generating in the background").
  const newOverview = useNewOverviewRun();

  const readOverview = (overview: Overview) => {
    newOverview.dismiss();
    void navigate(Routes.overview(overview.id), { viewTransition: shouldAnimateNavigation() });
  };

  return (
    <div className={styles.root} ref={mastheadHeight.host} data-testid={appShellTestIds.root}>
      <header
        className={styles.masthead}
        ref={mastheadHeight.measured}
        data-testid={appShellTestIds.masthead}
      >
        <div className={styles.bar}>
          <Link className={styles.brand} to={Routes.home()}>
            <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true" className={styles.mark}>
              <circle cx="16" cy="14.5" r="7.5" fill="none" stroke="currentColor" strokeWidth="3" />
              <rect x="7" y="25" width="18" height="2.5" fill="currentColor" />
            </svg>
            <h1 className={styles.title}>The Overview</h1>
          </Link>

          <button
            type="button"
            className={styles.newOverviewButton}
            onClick={newOverview.open}
            aria-haspopup="dialog"
            aria-expanded={newOverview.dialogOpen}
            data-testid={appShellTestIds.newOverviewButton}
          >
            + New
          </button>

          <nav className={styles.nav} aria-label="Sections">
            <NavLink
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
              to={Routes.home()}
              viewTransition={animateNavigation}
              end
            >
              Overviews
            </NavLink>
            <NavLink
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
              to={Routes.settings()}
              viewTransition={animateNavigation}
              data-testid={appShellTestIds.settingsLink}
            >
              Settings
            </NavLink>
          </nav>
        </div>

        {newOverview.run && !newOverview.dialogOpen && (
          <GenerationStatusStrip
            run={newOverview.run}
            onDetails={newOverview.open}
            onDismiss={newOverview.dismiss}
            onReadOverview={readOverview}
          />
        )}
      </header>

      <div className={styles.pane} data-testid={appShellTestIds.pane}>
        <Outlet />
      </div>

      <ScrollRestoration />

      <NewOverviewDialog
        open={newOverview.dialogOpen}
        run={newOverview.run}
        onSubmit={newOverview.start}
        onClose={newOverview.close}
        onDismiss={newOverview.dismiss}
        onReadOverview={readOverview}
      />
    </div>
  );
}
