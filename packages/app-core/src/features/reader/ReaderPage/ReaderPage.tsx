import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { OverviewId, isUnreadableRecordError, overviewMetaParts, overviewNoteLines, formatClock } from "@overview/domain";
import { useIsPanel } from "../../../app/LayoutContext.js";
import { RouteParams, Routes } from "../../../app/Routes.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { wasJustGenerated } from "../../newOverview/justGenerated.js";
import { PlusSavedLocallyNote } from "../../plus/components/PlusSavedLocallyNote/PlusSavedLocallyNote.js";
import { usePlusSavedLocallyNote } from "../../plus/usePlusSavedLocallyNote.js";
import { useDeleteOverviewMutation } from "../../overviews/mutations/useDeleteOverviewMutation.js";
import { useSetOverviewStateMutation } from "../../overviews/mutations/useSetOverviewStateMutation.js";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { useOverviewWithStateQuery } from "../../overviews/queries/overviewWithStateQuery.js";
import { useOverviewsWithStateQuery } from "../../overviews/queries/overviewsWithStateQuery.js";
import { orderLibraryEntriesBySavedAt } from "../../overviews/util/orderLibraryEntriesBySavedAt.js";
import { CaptureReasonLine } from "../components/CaptureReasonLine/CaptureReasonLine.js";
import { ChaptersPanel } from "../components/ChaptersPanel/ChaptersPanel.js";
import { DeleteOverviewDialog } from "../components/DeleteOverviewDialog/DeleteOverviewDialog.js";
import { ReadAlongNote } from "../components/ReadAlongNote/ReadAlongNote.js";
import { ReaderMasthead } from "../components/ReaderMasthead/ReaderMasthead.js";
import { ReaderPlayerBar } from "../components/ReaderPlayerBar/ReaderPlayerBar.js";
import { ReaderTabs } from "../components/ReaderTabs/ReaderTabs.js";
import { ShareOverviewDialog } from "../../shares/components/ShareOverviewDialog/ShareOverviewDialog.js";
import { useShareOverviewMutation } from "../../shares/mutations/useShareOverviewMutation.js";
import { useStopSharingMutation } from "../../shares/mutations/useStopSharingMutation.js";
import { useOverviewShare } from "../../shares/useOverviewShare.js";
import { UnreadableOverview } from "../components/UnreadableOverview/UnreadableOverview.js";
import { TranscriptPanel } from "../components/TranscriptPanel/TranscriptPanel.js";
import { WatchAnywayJump } from "../components/WatchAnywayJump/WatchAnywayJump.js";
import type { ReaderTab } from "../types/ReaderTab.js";
import { overviewNeighbours } from "../util/overviewNeighbours.js";
import { useNotePlayer } from "./useNotePlayer.js";
import { usePlayer } from "../../player/PlayerContext.js";
import { playerTrackFor } from "../../player/types/PlayerTrack.js";
import { playerBarView } from "../../player/util/playerBarView.js";
import { useSync } from "../../sync/SyncContext.js";
import { useMeasuredHeight } from "../../../util/useMeasuredHeight.js";
import { useShouldAnimateNavigation } from "../../../util/viewTransitions.js";
import styles from "./ReaderPage.module.scss";
import { readerPageTestIds } from "./ReaderPageTestIds.js";

const READER_TABS_HEIGHT_PROPERTY = "--reader-tabs-height";
const READER_MASTHEAD_HEIGHT_PROPERTY = "--reader-masthead-height";

const tabId = (tab: ReaderTab) => `reader-tab-${tab.toLowerCase()}`;
const panelId = (tab: ReaderTab) => `reader-panel-${tab.toLowerCase()}`;

export function ReaderPage() {
  const params = useParams();
  const parsedId = OverviewId.safeParse(params[RouteParams.overviewId]);

  if (!parsedId.success) {
    return <ReaderNotFound />;
  }
  return <ReaderPageForOverview overviewId={parsedId.data} />;
}

function ReaderPageForOverview({ overviewId }: { overviewId: OverviewId }) {
  const overviewQuery = useOverviewWithStateQuery(overviewId);
  const libraryQuery = useOverviewsWithStateQuery();
  const setOverviewState = useSetOverviewStateMutation();
  const deleteOverview = useDeleteOverviewMutation();
  const navigate = useNavigate();
  const animateNavigation = useShouldAnimateNavigation();
  const [tab, setTab] = useState<ReaderTab>("Overview");
  const [transcriptOpenAtMs, setTranscriptOpenAtMs] = useState<number | null>(null);
  const [editingTopics, setEditingTopics] = useState(false);
  const [editingReason, setEditingReason] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [sharing, setSharing] = useState(false);
  const tabsHeight = useMeasuredHeight<HTMLElement, HTMLDivElement>(READER_TABS_HEIGHT_PROPERTY);
  const readerMastheadHeight = useMeasuredHeight<HTMLElement, HTMLElement>(
    READER_MASTHEAD_HEIGHT_PROPERTY,
  );
  const isPanel = useIsPanel();

  // Two measurements, one element to publish them on. The setters are stable, so this
  // is too — a fresh arrow would tear both observers down on every render.
  const publishHeightsOn = useCallback(
    (element: HTMLElement | null) => {
      tabsHeight.host(element);
      readerMastheadHeight.host(element);
    },
    [tabsHeight.host, readerMastheadHeight.host],
  );
  const [playerDocked, setPlayerDocked] = useState(false);
  const savedLocallyNote = usePlusSavedLocallyNote(wasJustGenerated(useLocation().state));

  // A chapter opens the transcript at its start; choosing the tab yourself opens it at
  // the top, so the target is cleared by every other route to it.
  const changeTab = (next: ReaderTab) => {
    setTranscriptOpenAtMs(null);
    setTab(next);
  };
  const openTranscriptAt = (positionMs: number) => {
    setTranscriptOpenAtMs(positionMs);
    setTab("Transcript");
  };

  // The line lives on the Overview tab, so asking to edit it from any other tab brings
  // that tab back first.
  const editReason = () => {
    changeTab("Overview");
    setEditingReason(true);
  };

  const overview = overviewQuery.data?.overview ?? null;
  const lines = useMemo(() => (overview ? overviewNoteLines(overview) : []), [overview]);
  const track = useMemo(() => (overview ? playerTrackFor(overview, lines) : null), [overview, lines]);
  const notePlayer = useNotePlayer(track);
  const player = usePlayer();
  const sync = useSync();
  const overviewShare = useOverviewShare(overview);
  const shareOverview = useShareOverviewMutation();
  const stopSharing = useStopSharingMutation();

  // Design 2d: the panel's Listen plays straight away and docks the bar; the Plus prompt
  // it used to raise is retired, since audio is open to every account
  // (docs/features/audio-player.md). Docking is its own state rather than a read of
  // playing: pausing from the bar must not take the bar away.
  const listen = () => {
    if (playerDocked) {
      setPlayerDocked(false);
      notePlayer.pause();
      return;
    }
    setPlayerDocked(true);
    if (!notePlayer.playing) notePlayer.play();
  };

  // Design 2: [ and ] step a line, now that the transport's arrows move fifteen seconds.
  const { stepLine } = notePlayer;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "[" && event.key !== "]") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      stepLine(event.key === "]" ? 1 : -1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepLine]);

  if (overviewQuery.isPending) {
    return (
      <div className={styles.state} data-testid={readerPageTestIds.skeleton}>
        <div className={styles.skeletonBar} style={{ width: "40%" }} />
        <div className={styles.skeletonBar} style={{ width: "80%" }} />
        <div className={styles.skeletonBar} style={{ width: "100%" }} />
        <div className={styles.skeletonBar} style={{ width: "100%" }} />
      </div>
    );
  }

  // Try again is withheld from a record that fails to parse deterministically: retrying
  // it returns the same screen, and the reader who concludes the app is broken and clears
  // site data destroys what a later migration would have recovered
  // (docs/features/error-state.md).
  if (overviewQuery.isError) {
    if (isUnreadableRecordError(overviewQuery.error)) {
      return <UnreadableOverview record={overviewQuery.error.record} />;
    }
    return (
      <ErrorState
        title="Couldn't load this overview"
        body="Something went wrong reading it. Nothing has been lost."
        action={{ label: "Try again", onSelect: () => void overviewQuery.refetch() }}
        back
      />
    );
  }

  if (!overviewQuery.data || !overview) {
    return <ReaderNotFound />;
  }

  const { state } = overviewQuery.data;
  const openedFromChapterIndex =
    transcriptOpenAtMs === null || overview.chapters === null
      ? -1
      : overview.chapters.findIndex((chapter) => chapter.startMs === transcriptOpenAtMs);
  const openedFromChapter = overview.chapters?.[openedFromChapterIndex];
  const openedFrom =
    openedFromChapter === undefined
      ? null
      : { number: openedFromChapterIndex + 1, title: openedFromChapter.title };
  const toggleFavourite = () =>
    setOverviewState.mutate({ overviewId, patch: { favourite: !state.favourite } });
  const neighbours = overviewNeighbours(
    orderLibraryEntriesBySavedAt(libraryQuery.data ?? []),
    overviewId,
  );
  const range = overview.watchAnyway?.range ?? null;
  const barView = playerBarView(notePlayer.snapshot, notePlayer.time, { read: state.read });
  const narrated =
    notePlayer.current && notePlayer.snapshot.source === "audio" && notePlayer.snapshot.availability === "ready";
  const lineStartLabels = narrated ? notePlayer.snapshot.timings.lineStarts.map(formatClock) : null;
  const confirmDelete = () => {
    setConfirmingDelete(false);
    deleteOverview.mutate({ overviewId });
    void navigate(Routes.home(), { replace: true, viewTransition: animateNavigation });
  };

  return (
    <article
      className={`${styles.root} ${isPanel ? styles.panelRoot : ""}`}
      ref={publishHeightsOn}
      data-testid={readerPageTestIds.root}
    >
      <ReaderMasthead
        overview={overview}
        metaParts={overviewMetaParts(overview)}
        read={state.read}
        favourite={state.favourite}
        playing={notePlayer.playing}
        editingTopics={editingTopics}
        compact={isPanel}
        listening={playerDocked}
        // Measured only where it sticks: published on the wide reader it would push the
        // tab strip down by the height of a masthead that scrolls away.
        ref={isPanel ? readerMastheadHeight.measured : undefined}
        onToggleRead={() => setOverviewState.mutate({ overviewId, patch: { read: !state.read } })}
        onToggleFavourite={toggleFavourite}
        onTogglePlaying={notePlayer.main}
        onListen={listen}
        onEditingTopicsChange={setEditingTopics}
        onEditReason={editReason}
        onShare={
          overviewShare.available
            ? () => {
                overviewShare.refresh();
                setSharing(true);
              }
            : null
        }
        onDelete={() => setConfirmingDelete(true)}
      />

      {savedLocallyNote.shown && <PlusSavedLocallyNote onDismiss={savedLocallyNote.dismiss} />}

      <ReaderTabs
        active={tab}
        tabId={tabId}
        panelId={panelId}
        onChange={changeTab}
        ref={tabsHeight.measured}
      />

      <div
        key={tab}
        className={`${styles.main} ${styles.panel}`}
        role="tabpanel"
        id={panelId(tab)}
        aria-labelledby={tabId(tab)}
      >
        {tab === "Overview" && (
          <div className={styles.note} data-testid={readerPageTestIds.overviewPanel}>
            <CaptureReasonLine
              overview={overview}
              editing={editingReason}
              compact={isPanel}
              onEditingChange={setEditingReason}
            />
            <ReadAlongNote
              lines={lines}
              activeIndex={notePlayer.activeIndex}
              lineStartLabels={lineStartLabels}
              onSelectLine={notePlayer.selectLine}
            />
            {range !== null && <WatchAnywayJump range={range} videoId={overview.video.id} />}
            <div className={styles.tagRow} data-testid={readerPageTestIds.tagRow}>
              {overview.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        {tab === "Transcript" && (
          <TranscriptPanel
            key={overview.video.id}
            video={overview.video}
            openAtMs={transcriptOpenAtMs}
            openedFrom={openedFrom}
            onBackToChapters={() => changeTab("Chapters")}
          />
        )}
        {tab === "Chapters" && (
          <ChaptersPanel
            chapters={overview.chapters}
            video={overview.video}
            onOpenTranscriptAt={openTranscriptAt}
          />
        )}
      </div>

      {/* Where the library's order takes you next. At the foot rather than on the bar:
          the next note is a thing to want once this one is read (design 4a has no
          stepper, and the panel has no list to step through). */}
      {!isPanel && neighbours.position !== null && (
        <nav className={styles.foot} aria-label="Neighbouring overviews">
          {neighbours.previousId ? (
            <Link
              className={styles.stepLink}
              to={Routes.overview(neighbours.previousId)}
              viewTransition={animateNavigation}
              data-testid={readerPageTestIds.previousLink}
            >
              <StrokeIcon name="arrowLeft" />
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className={styles.position} data-testid={readerPageTestIds.position}>
            {neighbours.position} of {neighbours.total}
          </span>
          {neighbours.nextId ? (
            <Link
              className={styles.stepLink}
              to={Routes.overview(neighbours.nextId)}
              viewTransition={animateNavigation}
              data-testid={readerPageTestIds.nextLink}
            >
              Next
              <StrokeIcon name="arrowRight" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      {confirmingDelete && (
        <DeleteOverviewDialog
          title={overview.video.title}
          onDelete={confirmDelete}
          onClose={() => setConfirmingDelete(false)}
        />
      )}

      {sharing && (
        <ShareOverviewDialog
          share={overviewShare.share}
          edited={overviewShare.edited}
          signedIn={sync.connected}
          busy={shareOverview.isPending || stopSharing.isPending}
          failed={shareOverview.isError || stopSharing.isError}
          onCreate={() => shareOverview.mutate({ overview })}
          onStop={() => {
            if (overviewShare.share !== null) {
              stopSharing.mutate({ token: overviewShare.share.token });
            }
          }}
          onSignIn={() => void navigate(Routes.signIn(), { viewTransition: animateNavigation })}
          onClose={() => setSharing(false)}
        />
      )}

      {(!isPanel || playerDocked) && (
        <ReaderPlayerBar
          view={barView}
          time={notePlayer.time}
          lines={lines}
          lineStarts={notePlayer.snapshot.timings.lineStarts}
          durationSeconds={notePlayer.snapshot.timings.durationSeconds}
          favourite={isPanel ? { on: state.favourite, onToggle: toggleFavourite } : null}
          canSignIn={sync.available}
          onMain={notePlayer.main}
          onSkip={(delta) => player.skip(delta)}
          onSeek={(seconds) => player.seek(seconds)}
          onCycleRate={() => player.cycleRate()}
          onAction={(action) => {
            if (action === "markRead") {
              setOverviewState.mutate({ overviewId, patch: { read: true } });
            } else if (action === "tryAgain") {
              notePlayer.play();
            } else {
              player.readAlong();
            }
          }}
          onReRecord={() => player.reRecord()}
        />
      )}
    </article>
  );
}

function ReaderNotFound() {
  return (
    <div className={styles.state}>
      <p className={styles.error} data-testid={readerPageTestIds.notFound}>
        That overview isn't in your library.
      </p>
      <Link to={Routes.home()}>← All overviews</Link>
    </div>
  );
}
