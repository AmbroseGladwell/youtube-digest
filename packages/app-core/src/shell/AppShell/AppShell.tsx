import { useLayoutEffect, useRef } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from "react-router";
import type { Overview } from "@overview/domain";
import { useIsPanel } from "../../app/LayoutContext.js";
import { Routes } from "../../app/Routes.js";
import { OverviewMark } from "../../components/shared/OverviewMark/OverviewMark.js";
import { StrokeIcon } from "../../components/shared/StrokeIcon/StrokeIcon.js";
import { MiniPlayer } from "../../features/player/components/MiniPlayer/MiniPlayer.js";
import { AccountMenu } from "../../features/auth/components/AccountMenu/AccountMenu.js";
import { GenerationStatusStrip } from "../../features/newOverview/components/GenerationStatusStrip/GenerationStatusStrip.js";
import { NewOverviewDialog } from "../../features/newOverview/components/NewOverviewDialog/NewOverviewDialog.js";
import { NewOverviewRunProvider } from "../../features/newOverview/NewOverviewRunContext.js";
import { useNewOverviewRun } from "../../features/newOverview/useNewOverviewRun.js";
import { useRunBridgeExchange } from "../../features/newOverview/useRunBridgeExchange.js";
import { StaleClientBanner } from "../../features/sync/components/StaleClientBanner/StaleClientBanner.js";
import { WriteFloorWall } from "../../features/sync/components/WriteFloorWall/WriteFloorWall.js";
import { useSync } from "../../features/sync/SyncContext.js";
import { useWatchedTranscriptQuery } from "../../features/transcripts/queries/watchedTranscriptQuery.js";
import { useMeasuredHeight } from "../../util/useMeasuredHeight.js";
import {
  navigationDirection,
  shouldAnimateNavigation,
  useShouldAnimateNavigation,
} from "../../util/viewTransitions.js";
import styles from "./AppShell.module.scss";
import "./paneTransitions.scss";
import { appShellTestIds } from "./AppShellTestIds.js";
import { useAnalytics } from "../../features/analytics/AnalyticsContext.js";

const MASTHEAD_HEIGHT_PROPERTY = "--masthead-height";

export function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPanel = useIsPanel();
  const mastheadHeight = useMeasuredHeight(MASTHEAD_HEIGHT_PROPERTY);
  const animateNavigation = useShouldAnimateNavigation();
  const sync = useSync();
  const onAuthPage = pathname === Routes.signIn() || pathname === Routes.createAccount();
  const belowWriteFloor = sync.status.phase === "unsupported";

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
  const analytics = useAnalytics();

  // The injected YouTube button's end of that same run
  // (docs/features/injected-button.md).
  useRunBridgeExchange(newOverview);

  // Held here rather than in the dialog so the captions are already in hand by the time
  // the dialog is opened at all (docs/features/watching-detection.md).
  useWatchedTranscriptQuery();

  const readOverview = (overview: Overview) => {
    newOverview.dismiss();
    void navigate(Routes.overview(overview.id), { viewTransition: shouldAnimateNavigation() });
  };

  return (
    <NewOverviewRunProvider value={newOverview}>
      <div className={styles.root} ref={mastheadHeight.host} data-testid={appShellTestIds.root}>
        <header
          className={styles.masthead}
          ref={mastheadHeight.measured}
          data-testid={appShellTestIds.masthead}
        >
          <div className={styles.bar}>
            <Link
              className={styles.brand}
              to={Routes.home()}
              onClick={() => analytics.app.masthead.homeChosen()}
              data-testid={appShellTestIds.brand}
            >
              <OverviewMark />
              <h1 className={`${styles.title} ${isPanel ? styles.titlePanel : ""}`}>
                {isPanel ? "Overview" : "The Overview"}
              </h1>
            </Link>

            {isPanel ? (
              <span className={styles.panelActions}>
                <AccountMenu />
              </span>
            ) : (
              <>
                <nav className={styles.nav} aria-label="Sections">
                  <NavLink
                    className={({ isActive }) =>
                      `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
                    }
                    to={Routes.home()}
                    viewTransition={animateNavigation}
                    onClick={() => analytics.app.masthead.overviewsChosen()}
                    end
                  >
                    Overviews
                  </NavLink>
                </nav>

                <span className={`${styles.actions} ${onAuthPage ? styles.actionsBesideNotNow : ""}`}>
                  <button
                    type="button"
                    className={styles.newOverviewButton}
                    onClick={() => {
                      analytics.capture.newOverviewDialog.opened({ from: "newButton" });
                      newOverview.open();
                    }}
                    aria-haspopup="dialog"
                    aria-expanded={newOverview.dialogOpen}
                    data-testid={appShellTestIds.newOverviewButton}
                  >
                    <StrokeIcon name="plus" />
                    New
                  </button>
                  <AccountMenu />
                </span>
                {onAuthPage && (
                  <Link
                    className={styles.notNowLink}
                    to={Routes.home()}
                    viewTransition={animateNavigation}
                    onClick={() => analytics.app.masthead.notNowChosen()}
                    data-testid={appShellTestIds.notNowLink}
                  >
                    Not now
                  </Link>
                )}
              </>
            )}
          </div>

          <StaleClientBanner />

          {!isPanel && newOverview.run && !newOverview.dialogOpen && (
            <GenerationStatusStrip
              run={newOverview.run}
              onDetails={newOverview.open}
              onDismiss={newOverview.dismiss}
              onReadOverview={readOverview}
            />
          )}
        </header>

        <div className={styles.pane} data-testid={appShellTestIds.pane}>
          {belowWriteFloor ? <WriteFloorWall generating={newOverview.run !== null} /> : <Outlet />}
        </div>

        <MiniPlayer />

        <ScrollRestoration />

        {!isPanel && (
          <NewOverviewDialog
            open={newOverview.dialogOpen}
            run={newOverview.run}
            onSubmit={(url) => newOverview.start(url, { from: "dialog" })}
            onClose={newOverview.close}
            onDismiss={newOverview.dismiss}
            onReadOverview={readOverview}
            onCaptureReasonChange={newOverview.setCaptureReason}
            onCaptureReasonCommit={newOverview.commitCaptureReason}
          />
        )}
      </div>
    </NewOverviewRunProvider>
  );
}
