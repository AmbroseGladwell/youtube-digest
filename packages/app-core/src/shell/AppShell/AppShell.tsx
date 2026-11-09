import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from "react-router";
import type { Overview } from "@overview/domain";
import { useIsPanel } from "../../app/LayoutContext.js";
import { BackLinkHandoffProvider, type HeadBackLink } from "../../app/BackLinkHandoffContext.js";
import { HistoryTrailProvider } from "../../app/HistoryTrailContext.js";
import { Routes } from "../../app/Routes.js";
import { OverviewMark } from "../../components/shared/OverviewMark/OverviewMark.js";
import { StrokeIcon } from "../../components/shared/StrokeIcon/StrokeIcon.js";
import { MiniPlayer } from "../../features/player/components/MiniPlayer/MiniPlayer.js";
import { AccountMenu } from "../../features/auth/components/AccountMenu/AccountMenu.js";
import { SignedOutGate } from "../../features/accountLibraries/components/SignedOutGate/SignedOutGate.js";
import { LibraryMoveNotice } from "../../features/accountLibraries/components/LibraryMoveNotice/LibraryMoveNotice.js";
import { SignOutNotice } from "../../features/accountLibraries/components/SignOutNotice/SignOutNotice.js";
import { useLibraryMove } from "../../features/accountLibraries/LibraryMoveContext.js";
import { useAccountNeeded } from "../../features/accountLibraries/useAccountNeeded.js";
import { markAccountSeen } from "../../features/accountLibraries/accountSeenStorage.js";
import { GenerationStatusStrip } from "../../features/newOverview/components/GenerationStatusStrip/GenerationStatusStrip.js";
import { NewOverviewDialog } from "../../features/newOverview/components/NewOverviewDialog/NewOverviewDialog.js";
import { NewOverviewRunProvider } from "../../features/newOverview/NewOverviewRunContext.js";
import { useNewOverviewRun } from "../../features/newOverview/useNewOverviewRun.js";
import { useArticleMenuRequest } from "../../features/newOverview/useArticleMenuRequest.js";
import { useRunBridgeExchange } from "../../features/newOverview/useRunBridgeExchange.js";
import { StaleClientBanner } from "../../features/sync/components/StaleClientBanner/StaleClientBanner.js";
import { WriteFloorWall } from "../../features/sync/components/WriteFloorWall/WriteFloorWall.js";
import { useSync } from "../../features/sync/SyncContext.js";
import { useWatchedTranscriptQuery } from "../../features/transcripts/queries/watchedTranscriptQuery.js";
import { useMeasuredHeight } from "../../util/useMeasuredHeight.js";
import { useIsPhone } from "../../util/useIsPhone.js";
import { useMediaQuery } from "../../util/useMediaQuery.js";
import { useBackInBar } from "./useBackInBar.js";
import { PageScrolledSentinel } from "../../components/shared/PageScrolledSentinel/PageScrolledSentinel.js";
import { useHistoryTrail } from "./useHistoryTrail.js";
import { CaptureQueueProvider } from "../../features/captureQueue/CaptureQueueContext.js";
import { CaptureQueueStripView } from "../../features/captureQueue/components/CaptureQueueStripView/CaptureQueueStripView.js";
import { QueueRunDialog } from "../../features/captureQueue/components/QueueRunDialog/QueueRunDialog.js";
import { useCaptureQueue } from "../../features/captureQueue/useCaptureQueue.js";
import { navigationDirection, shouldAnimateNavigation, useShouldAnimateNavigation } from "../../util/viewTransitions.js";
import styles from "./AppShell.module.scss";
import "./paneTransitions.scss";
import { appShellTestIds } from "./AppShellTestIds.js";
import { useAnalytics } from "../../features/analytics/AnalyticsContext.js";
import { PageLink } from "../../components/shared/PageLink/PageLink.js";
import { OnThisTabLine } from "../../features/capture/components/OnThisTabLine/OnThisTabLine.js";
import { useOnThisTab } from "../../features/capture/useOnThisTab.js";

const MASTHEAD_HEIGHT_PROPERTY = "--masthead-height";
// Where the note's head uses the phone arrangement and scrolls away (ReaderMasthead.module.scss).
const HEAD_SCROLLS_AWAY_QUERY = "(max-width: 61.9375rem)";

export function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPanel = useIsPanel();
  const mastheadHeight = useMeasuredHeight(MASTHEAD_HEIGHT_PROPERTY);
  const [band, setBand] = useState<HTMLElement | null>(null);
  const measureBand = useCallback(
    (element: HTMLElement | null) => {
      mastheadHeight.measured(element);
      setBand(element);
    },
    [mastheadHeight.measured],
  );
  const trail = useHistoryTrail();
  // The app's one NavLink, which PageLink can't stand in for because the active styling is
  // NavLink's (docs/features/page-transitions.md).
  const animateNavigation = useShouldAnimateNavigation();
  const sync = useSync();
  const onAuthPage = pathname === Routes.signIn() || pathname === Routes.createAccount();
  const belowWriteFloor = sync.status.phase === "unsupported";
  const onHome = pathname === Routes.home();
  // Signed out where there are accounts, every page that would show an overview shows the
  // way to an account instead; home is onboarding's Start, or in the panel once this device has
  // had an account, the way back to it (docs/architecture/tiers.md, "Signed out";
  // docs/features/onboarding.md).
  const accountNeeded = useAccountNeeded();
  const gated = accountNeeded && (pathname === Routes.queue() || pathname.startsWith(Routes.overview("")));
  const signedIn = sync.connected;
  useEffect(() => {
    if (signedIn) markAccountSeen();
  }, [signedIn]);
  const libraryMoved = useLibraryMove().move !== null;
  // With a note open and the tab moved on under it, the band says so (design 205e).
  const onThisTab = useOnThisTab();

  // paneTransitions.scss keys the way in and the way back off this, and it has to be on
  // the root: ::view-transition-* pseudo-elements can't see an attribute further down. A
  // layout effect lands it inside the router's own DOM update, which is the moment the
  // browser takes the "after" snapshot.
  const previousPathname = useRef(pathname);
  useLayoutEffect(() => {
    document.documentElement.dataset.navDirection = navigationDirection(previousPathname.current, pathname);
    previousPathname.current = pathname;
  }, [pathname]);

  // The shell is the one component that survives every navigation, so the run it owns can
  // outlive both the dialog it was started from and the page it was started on
  // (docs/features/overview-redesign.md, "Generating in the background").
  const newOverview = useNewOverviewRun();
  const analytics = useAnalytics();
  const isPhone = useIsPhone();
  const readerRun = newOverview.run;
  const captureQueue = useCaptureQueue({
    readerRunActive: readerRun !== null && readerRun.overview === null && readerRun.error === null,
  });
  const [queueDetailsOpen, setQueueDetailsOpen] = useState(false);

  // Design OV-167 (167a–167c): once the page's own back link has scrolled under the band,
  // the brand slot holds that link instead (docs/features/back-within-reach.md).
  const [headBackLink, setHeadBackLink] = useState<HeadBackLink | null>(null);
  const handoff = useMemo(() => ({ register: setHeadBackLink }), []);
  const headScrollsAway = useMediaQuery(HEAD_SCROLLS_AWAY_QUERY);
  // The panel gets the phone's hand-off: the slot takes the page's own link once that
  // link passes under the band (205h). Not by width — Chrome lets the reader drag the
  // panel wider and it stays the panel, keeping its own arrangement (205w).
  const handoffLive = headBackLink !== null && (isPanel || headScrollsAway);
  const backInBar = useBackInBar(band, headBackLink, handoffLive);
  const brandLink = useRef<HTMLAnchorElement>(null);
  const barBackLink = useRef<HTMLAnchorElement>(null);
  useLayoutEffect(() => {
    const leaving = backInBar ? brandLink.current : barBackLink.current;
    const arriving = backInBar ? barBackLink.current : brandLink.current;
    if (leaving !== null && document.activeElement === leaving) arriving?.focus({ preventScroll: true });
  }, [backInBar]);

  // Design 205c-2: in the panel + New is a way to paste a link, not a place to watch a
  // run. Home is the run's own page there, so starting one closes the dialog and hands
  // the panel back to home, which is where creating from the offer would have left it.
  const panelRunStarted = newOverview.run !== null && newOverview.dialogOpen && isPanel;
  useEffect(() => {
    if (!panelRunStarted) return;
    newOverview.close();
    void navigate(Routes.home(), { replace: true });
  }, [panelRunStarted, newOverview, navigate]);

  const panelOpened = useRef(false);
  useEffect(() => {
    if (!isPanel || panelOpened.current) return;
    panelOpened.current = true;
    analytics.extension.sidePanel.opened();
  }, [isPanel, analytics]);

  // The injected YouTube button's end of that same run
  // (docs/features/injected-button.md).
  useRunBridgeExchange(newOverview);
  useArticleMenuRequest(newOverview);

  // Held here rather than in the dialog so the captions are already in hand by the time
  // the dialog is opened at all (docs/features/watching-detection.md).
  useWatchedTranscriptQuery();

  const readOverview = (overview: Overview) => {
    newOverview.dismiss();
    void navigate(Routes.overview(overview.id), { viewTransition: shouldAnimateNavigation() });
  };

  // Onboarding brings its own head, with nothing to navigate to until there is an account
  // (docs/features/onboarding.md).
  if (pathname === Routes.onboarding()) {
    return (
      <NewOverviewRunProvider value={newOverview}>
        <CaptureQueueProvider value={captureQueue}>
          <HistoryTrailProvider value={trail}>
            <Outlet />
            <ScrollRestoration />
          </HistoryTrailProvider>
        </CaptureQueueProvider>
      </NewOverviewRunProvider>
    );
  }

  return (
    <NewOverviewRunProvider value={newOverview}>
      <CaptureQueueProvider value={captureQueue}>
        <HistoryTrailProvider value={trail}>
          <BackLinkHandoffProvider value={handoff}>
            <div className={styles.root} ref={mastheadHeight.host} data-testid={appShellTestIds.root}>
              <PageScrolledSentinel />
              <header className={styles.masthead} ref={measureBand} data-sticky-fade="" data-testid={appShellTestIds.masthead}>
                <div className={styles.bar}>
                  <div
                    className={`${styles.brandSlot} ${handoffLive ? styles.brandSlotLive : ""} ${backInBar ? styles.brandSlotBack : ""}`}
                    data-testid={appShellTestIds.brandSlot}
                  >
                    <PageLink
                      ref={brandLink}
                      className={styles.brand}
                      to={Routes.home()}
                      onClick={() => analytics.app.masthead.homeChosen()}
                      inert={backInBar}
                      aria-hidden={backInBar || undefined}
                      data-testid={appShellTestIds.brand}
                    >
                      <span className={styles.mark}>
                        <OverviewMark />
                      </span>
                      <h1 className={`${styles.title} ${isPanel ? styles.titlePanel : ""}`}>The Overview</h1>
                    </PageLink>
                    {handoffLive && (
                      <PageLink
                        ref={barBackLink}
                        className={styles.backLink}
                        to={headBackLink.to}
                        onClick={headBackLink.follow}
                        inert={!backInBar}
                        aria-hidden={!backInBar || undefined}
                        data-testid={appShellTestIds.backLink}
                      >
                        <span className={styles.arrow}>
                          <StrokeIcon name="arrowLeft" size={17} />
                        </span>
                        <span className={styles.backLabel}>{headBackLink.label}</span>
                      </PageLink>
                    )}
                  </div>

                  {isPanel ? (
                    <span className={styles.panelActions}>
                      {!accountNeeded && (
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
                      )}
                      <AccountMenu />
                    </span>
                  ) : (
                    <>
                      <nav className={styles.nav} aria-label="Sections">
                        <NavLink
                          className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
                          to={Routes.home()}
                          viewTransition={animateNavigation}
                          onClick={() => analytics.app.masthead.overviewsChosen()}
                          end
                        >
                          Overviews
                        </NavLink>
                      </nav>

                      <span className={`${styles.actions} ${onAuthPage ? styles.actionsBesideNotNow : ""}`}>
                        {!accountNeeded && (
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
                        )}
                        <AccountMenu />
                      </span>
                      {onAuthPage && (
                        <PageLink
                          className={styles.notNowLink}
                          to={Routes.home()}
                          onClick={() => analytics.app.masthead.notNowChosen()}
                          data-testid={appShellTestIds.notNowLink}
                        >
                          Not now
                        </PageLink>
                      )}
                    </>
                  )}
                </div>

                <StaleClientBanner />

                {onThisTab !== null && <OnThisTabLine tab={onThisTab} onStartVideo={(url) => newOverview.start(url, { from: "panel" })} />}

                {!isPanel && newOverview.run && !newOverview.dialogOpen ? (
                  <GenerationStatusStrip
                    run={newOverview.run}
                    onDetails={newOverview.open}
                    onDismiss={newOverview.dismiss}
                    onReadOverview={readOverview}
                  />
                ) : !isPanel && !newOverview.run && captureQueue.strip !== null ? (
                  <CaptureQueueStripView
                    strip={captureQueue.strip}
                    compact={isPhone}
                    folded={
                      onHome && captureQueue.folded
                        ? { attention: captureQueue.attention.length, onUnfold: () => captureQueue.setFolded(false) }
                        : null
                    }
                    onPause={() => captureQueue.setPaused(true)}
                    onResume={() => captureQueue.setPaused(false)}
                    onDetails={() => setQueueDetailsOpen(true)}
                    onDismiss={captureQueue.dismissStrip}
                  />
                ) : (
                  !isPanel && !newOverview.run && libraryMoved && <LibraryMoveNotice />
                )}
              </header>

              <div className={styles.pane} data-testid={appShellTestIds.pane}>
                {belowWriteFloor ? (
                  <WriteFloorWall generating={newOverview.run !== null} />
                ) : gated ? (
                  <SignedOutGate panel={isPanel} />
                ) : (
                  <Outlet />
                )}
              </div>

              <MiniPlayer />

              <SignOutNotice />

              <ScrollRestoration />

              {/* In the panel the dialog is only ever open: left mounted it would put a
                  second copy of the run's progress in the page, which is the panel's own
                  (design 205c-2). */}
              {!accountNeeded && (!isPanel || newOverview.dialogOpen) && (
                <NewOverviewDialog
                  open={newOverview.dialogOpen}
                  prefill={newOverview.prefill}
                  run={newOverview.run}
                  held={newOverview.held}
                  onSubmit={(url) => newOverview.start(url, { from: "dialog" })}
                  onOpenHeld={(overviewId) => {
                    newOverview.dismiss();
                    void navigate(Routes.overview(overviewId), { viewTransition: shouldAnimateNavigation() });
                  }}
                  onClose={newOverview.close}
                  onDismiss={newOverview.dismiss}
                  onReadOverview={readOverview}
                  onCaptureReasonChange={newOverview.setCaptureReason}
                  onCaptureReasonCommit={newOverview.commitCaptureReason}
                />
              )}

              <QueueRunDialog making={captureQueue.making} open={queueDetailsOpen} onClose={() => setQueueDetailsOpen(false)} />
            </div>
          </BackLinkHandoffProvider>
        </HistoryTrailProvider>
      </CaptureQueueProvider>
    </NewOverviewRunProvider>
  );
}
