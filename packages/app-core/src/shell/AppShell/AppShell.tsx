import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Outlet, ScrollRestoration, useLocation, useNavigate } from "react-router";
import type { Overview } from "@overview/domain";
import { useIsPanel } from "../../app/LayoutContext.js";
import { BackLinkHandoffProvider, type HeadBackLink } from "../../app/BackLinkHandoffContext.js";
import { HistoryTrailProvider } from "../../app/HistoryTrailContext.js";
import { Routes } from "../../app/Routes.js";
import { OverviewMark } from "../../components/shared/OverviewMark/OverviewMark.js";
import { StrokeIcon } from "../../components/shared/StrokeIcon/StrokeIcon.js";
import { MiniPlayer } from "../../features/player/components/MiniPlayer/MiniPlayer.js";
import { CookingTimerDock } from "../../features/cookingTimers/components/CookingTimerDock/CookingTimerDock.js";
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
import { useLongPressTip } from "../../util/useLongPressTip.js";
import { useMediaQuery } from "../../util/useMediaQuery.js";
import { useBackInBar } from "./useBackInBar.js";
import { PageScrolledSentinel } from "../../components/shared/PageScrolledSentinel/PageScrolledSentinel.js";
import { useHistoryTrail } from "./useHistoryTrail.js";
import { CaptureQueueProvider } from "../../features/captureQueue/CaptureQueueContext.js";
import { KeptLinksProvider } from "../../features/captures/KeptLinksContext.js";
import { useKeptLinks } from "../../features/captures/useKeptLinks.js";
import { useCaptureQueue } from "../../features/captureQueue/useCaptureQueue.js";
import { navigationDirection, shouldAnimateNavigation } from "../../util/viewTransitions.js";
import styles from "./AppShell.module.scss";
import "./paneTransitions.scss";
import { appShellTestIds } from "./AppShellTestIds.js";
import { useAnalytics } from "../../features/analytics/AnalyticsContext.js";
import { PageLink } from "../../components/shared/PageLink/PageLink.js";
import { OnThisTabLine } from "../../features/capture/components/OnThisTabLine/OnThisTabLine.js";
import { useOnThisTab } from "../../features/capture/useOnThisTab.js";
import { stickyChromeSizes } from "../../util/stickyChromeSizes.js";
import { SidebarShownProvider } from "../../app/SidebarContext.js";
import { useOverviewsWithStateQuery } from "../../features/overviews/queries/overviewsWithStateQuery.js";
import { useSavedCapturesQuery } from "../../features/captures/queries/savedCapturesQuery.js";
import { AppSidebar } from "../AppSidebar/AppSidebar.js";
import { useSidebar } from "./useSidebar.js";

// Mirrors the breakpoint in ReaderMasthead.module.scss.
const HEAD_SCROLLS_AWAY_QUERY = "(max-width: 61.9375rem)";
// Design 399d (D): phones, and a phone on its side, get the pages as icons and no sidebar.
const PHONE_NAV_QUERY = "(max-width: 47.9375rem), (pointer: coarse) and (max-height: 31.1875rem)";

const onSidebarPage = (pathname: string): boolean =>
  [Routes.home(), Routes.projects(), Routes.queue(), Routes.ask()].includes(pathname) || pathname.startsWith(Routes.project(""));

export const AppShell = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPanel = useIsPanel();
  const mastheadHeight = useMeasuredHeight(stickyChromeSizes.masthead);
  const [band, setBand] = useState<HTMLElement | null>(null);
  const measureBand = useCallback(
    (element: HTMLElement | null) => {
      mastheadHeight.measured(element);
      setBand(element);
    },
    [mastheadHeight.measured],
  );
  const trail = useHistoryTrail();
  const sync = useSync();
  const onAuthPage = pathname === Routes.signIn() || pathname === Routes.createAccount();
  const belowWriteFloor = sync.status.phase === "unsupported";
  // Why signed out sees no overviews: docs/architecture/tiers.md, "Signed out".
  const accountNeeded = useAccountNeeded();
  const gated = accountNeeded && (pathname === Routes.queue() || pathname.startsWith(Routes.overview("")));
  const signedIn = sync.connected;
  useEffect(() => {
    if (signedIn) {
      markAccountSeen();
    }
  }, [signedIn]);
  const libraryMoved = useLibraryMove().move !== null;
  const phoneNav = useMediaQuery(PHONE_NAV_QUERY);
  const hasEntries = (useOverviewsWithStateQuery().data?.length ?? 0) + (useSavedCapturesQuery().data?.length ?? 0) > 0;
  const sidebar = useSidebar(!isPanel && !phoneNav && !accountNeeded && hasEntries && onSidebarPage(pathname));
  const onThisTab = useOnThisTab();

  // On the root, the only place ::view-transition-* can see; set before the browser's "after" snapshot.
  const previousPathname = useRef(pathname);
  useLayoutEffect(() => {
    document.documentElement.dataset.navDirection = navigationDirection(previousPathname.current, pathname);
    previousPathname.current = pathname;
  }, [pathname]);

  // Why the shell owns the run: docs/features/overview-redesign.md, "Generating in the background".
  const newOverview = useNewOverviewRun();
  const analytics = useAnalytics();
  const isPhone = useIsPhone();
  const askTip = useLongPressTip(isPhone);
  const newTip = useLongPressTip(isPhone);
  const overviewsTip = useLongPressTip(isPhone);
  const projectsTip = useLongPressTip(isPhone);
  const readerRun = newOverview.run;
  const readerRunActive = readerRun !== null && readerRun.overview === null && readerRun.error === null;
  const captureQueue = useCaptureQueue({ readerRunActive });
  const keptLinks = useKeptLinks({ busy: readerRunActive });

  const [headBackLink, setHeadBackLink] = useState<HeadBackLink | null>(null);
  const handoff = useMemo(() => ({ register: setHeadBackLink }), []);
  const headScrollsAway = useMediaQuery(HEAD_SCROLLS_AWAY_QUERY);
  // Why the panel hands off at any width: docs/features/back-within-reach.md, "What was built".
  const handoffLive = headBackLink !== null && (isPanel || headScrollsAway);
  const backInBar = useBackInBar(band, headBackLink, handoffLive);
  const brandLink = useRef<HTMLAnchorElement>(null);
  const barBackLink = useRef<HTMLAnchorElement>(null);
  useLayoutEffect(() => {
    const leaving = backInBar ? brandLink.current : barBackLink.current;
    const arriving = backInBar ? barBackLink.current : brandLink.current;
    if (leaving !== null && document.activeElement === leaving) {
      arriving?.focus({ preventScroll: true });
    }
  }, [backInBar]);

  // In the panel, home is the run's own page, so starting a run from + New hands the panel back there.
  const panelRunStarted = newOverview.run !== null && newOverview.dialogOpen && isPanel;
  useEffect(() => {
    if (!panelRunStarted) {
      return;
    }
    newOverview.close();
    void navigate(Routes.home(), { replace: true });
  }, [panelRunStarted, newOverview, navigate]);

  const panelOpened = useRef(false);
  useEffect(() => {
    if (!isPanel || panelOpened.current) {
      return;
    }
    panelOpened.current = true;
    analytics.extension.sidePanel.opened();
  }, [isPanel, analytics]);

  useRunBridgeExchange(newOverview);
  useArticleMenuRequest(newOverview);

  // Held here rather than in the dialog, so the captions are in hand before the dialog opens.
  useWatchedTranscriptQuery();

  const readOverview = (overview: Overview) => {
    newOverview.dismiss();
    void navigate(Routes.overview(overview.id), { viewTransition: shouldAnimateNavigation() });
  };

  // Onboarding brings its own head, with nothing to navigate to until there is an account.
  if (pathname === Routes.onboarding()) {
    return (
      <NewOverviewRunProvider value={newOverview}>
        <CaptureQueueProvider value={captureQueue}>
          <KeptLinksProvider value={keptLinks}>
            <HistoryTrailProvider value={trail}>
              <Outlet />
              <ScrollRestoration />
            </HistoryTrailProvider>
          </KeptLinksProvider>
        </CaptureQueueProvider>
      </NewOverviewRunProvider>
    );
  }

  const pageIcon = (name: "Overviews" | "Projects", to: string, icon: "list" | "folder", on: boolean) => (
    <span className={styles.tipHost} {...(name === "Overviews" ? overviewsTip : projectsTip)}>
      <PageLink
        className={styles.pageIcon}
        to={to}
        aria-label={name}
        aria-current={on ? "page" : undefined}
        onClick={() => analytics.app.nav.pageChosen({ page: name === "Overviews" ? "overviews" : "projects", from: "masthead" })}
        data-testid={appShellTestIds.pageIcon(name)}
      >
        <StrokeIcon name={icon} size={19} />
      </PageLink>
      <span className={styles.tip} aria-hidden="true">
        {name}
      </span>
    </span>
  );

  const runStripOrNotice = () => {
    if (!isPanel && newOverview.run && !newOverview.dialogOpen) {
      return (
        <GenerationStatusStrip
          run={newOverview.run}
          onDetails={newOverview.open}
          onDismiss={newOverview.dismiss}
          onReadOverview={readOverview}
        />
      );
    }
    return !isPanel && !newOverview.run && libraryMoved && <LibraryMoveNotice />;
  };

  const paneContent = () => {
    if (belowWriteFloor) {
      return <WriteFloorWall generating={newOverview.run !== null} />;
    }
    return gated ? <SignedOutGate panel={isPanel} /> : <Outlet />;
  };

  return (
    <NewOverviewRunProvider value={newOverview}>
      <CaptureQueueProvider value={captureQueue}>
        <KeptLinksProvider value={keptLinks}>
          <HistoryTrailProvider value={trail}>
            <BackLinkHandoffProvider value={handoff}>
              <div
                className={`${styles.root} ${phoneNav ? styles.phoneNav : ""}`}
                ref={mastheadHeight.host}
                data-testid={appShellTestIds.root}
              >
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
                        <span className={`${styles.actions} ${onAuthPage ? styles.actionsBesideNotNow : ""}`}>
                          {phoneNav && !accountNeeded && (
                            <nav className={styles.nav} aria-label="Pages">
                              {pageIcon("Overviews", Routes.home(), "list", pathname === Routes.home())}
                              {pageIcon("Projects", Routes.projects(), "folder", pathname.startsWith(Routes.projects()))}
                            </nav>
                          )}
                          {!accountNeeded && signedIn && (
                            <span className={styles.tipHost} {...askTip}>
                              <PageLink
                                className={styles.askButton}
                                to={Routes.ask()}
                                aria-label="Ask your library"
                                aria-current={pathname === Routes.ask() ? "page" : undefined}
                                onClick={() => analytics.app.nav.pageChosen({ page: "ask", from: "masthead" })}
                                data-testid={appShellTestIds.askButton}
                              >
                                <StrokeIcon name="messageSquare" />
                                <span className={styles.buttonLabel}>Ask</span>
                              </PageLink>
                              <span className={styles.tip} aria-hidden="true">
                                Ask your library
                              </span>
                            </span>
                          )}
                          {!accountNeeded && (
                            <span className={styles.tipHost} {...newTip}>
                              <button
                                type="button"
                                className={`${styles.newOverviewButton} ${styles.iconOnPhone}`}
                                aria-label="New overview"
                                onClick={() => {
                                  analytics.capture.newOverviewDialog.opened({ from: "newButton" });
                                  newOverview.open();
                                }}
                                aria-haspopup="dialog"
                                aria-expanded={newOverview.dialogOpen}
                                data-testid={appShellTestIds.newOverviewButton}
                              >
                                <StrokeIcon name="plus" />
                                <span className={styles.buttonLabel}>New</span>
                              </button>
                              <span className={styles.tip} aria-hidden="true">
                                New overview
                              </span>
                            </span>
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

                  {onThisTab !== null && (
                    <OnThisTabLine tab={onThisTab} onStartVideo={(url) => newOverview.start(url, { from: "panel" })} />
                  )}

                  {runStripOrNotice()}
                </header>

                <div className={styles.body}>
                  {sidebar.available && (
                    <div
                      ref={sidebar.slot}
                      className={styles.sidebarSlot}
                      data-open={sidebar.open}
                      inert={!sidebar.open}
                      data-testid={appShellTestIds.sidebarSlot}
                    >
                      <AppSidebar onHide={() => sidebar.toggle("button")} />
                    </div>
                  )}
                  <div className={styles.pane} data-testid={appShellTestIds.pane}>
                    <SidebarShownProvider value={sidebar.shown}>{paneContent()}</SidebarShownProvider>
                  </div>
                </div>

                {sidebar.available && !sidebar.open && (
                  <span className={styles.showSidebarHost}>
                    <button
                      ref={sidebar.showButton}
                      type="button"
                      className={styles.showSidebar}
                      aria-label="Show sidebar"
                      aria-expanded="false"
                      aria-keyshortcuts="["
                      onClick={() => sidebar.toggle("button")}
                      data-testid={appShellTestIds.showSidebar}
                    >
                      <StrokeIcon name="panelOpen" size={17} />
                    </button>
                    <span className={styles.sideTip} aria-hidden="true">
                      Show sidebar · [
                    </span>
                  </span>
                )}

                <CookingTimerDock>
                  <MiniPlayer />
                </CookingTimerDock>

                <SignOutNotice />

                <ScrollRestoration />

                {/* Unmounted in the panel when closed, or the run's progress would show twice. */}
                {!accountNeeded && (!isPanel || newOverview.dialogOpen) && (
                  <NewOverviewDialog
                    open={newOverview.dialogOpen}
                    prefill={newOverview.prefill}
                    run={newOverview.run}
                    held={newOverview.held}
                    onSubmit={(url, options) => newOverview.start(url, { from: "dialog", saveInstead: options?.saveInstead })}
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
              </div>
            </BackLinkHandoffProvider>
          </HistoryTrailProvider>
        </KeptLinksProvider>
      </CaptureQueueProvider>
    </NewOverviewRunProvider>
  );
};
