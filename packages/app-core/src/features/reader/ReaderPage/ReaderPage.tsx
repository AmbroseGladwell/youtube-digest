import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { OverviewId } from "@overview/types";
import { useIsPanel } from "../../../app/LayoutContext.js";
import { RouteParams, Routes } from "../../../app/Routes.js";
import { wasJustGenerated } from "../../newOverview/justGenerated.js";
import { PlusPrompt } from "../../plus/components/PlusPrompt/PlusPrompt.js";
import { PlusSavedLocallyNote } from "../../plus/components/PlusSavedLocallyNote/PlusSavedLocallyNote.js";
import { usePlan } from "../../plus/usePlan.js";
import { usePlusSavedLocallyNote } from "../../plus/usePlusSavedLocallyNote.js";
import { useSetOverviewStateMutation } from "../../overviews/mutations/useSetOverviewStateMutation.js";
import { useOverviewWithStateQuery } from "../../overviews/queries/overviewWithStateQuery.js";
import { useOverviewsWithStateQuery } from "../../overviews/queries/overviewsWithStateQuery.js";
import { useTopicsQuery } from "../../overviews/queries/topicsQuery.js";
import { formatTimeRange } from "../../overviews/util/formatTimeRange.js";
import { orderOverviewsBySavedAt } from "../../overviews/util/orderOverviewsBySavedAt.js";
import { youtubeTimestampUrl } from "../../overviews/util/youtubeTimestampUrl.js";
import { ChaptersPanel } from "../components/ChaptersPanel/ChaptersPanel.js";
import { ReadAlongNote } from "../components/ReadAlongNote/ReadAlongNote.js";
import { ReaderMasthead } from "../components/ReaderMasthead/ReaderMasthead.js";
import { ReaderPlayerBar } from "../components/ReaderPlayerBar/ReaderPlayerBar.js";
import { ReaderRail } from "../components/ReaderRail/ReaderRail.js";
import { ReaderTabs } from "../components/ReaderTabs/ReaderTabs.js";
import { TranscriptPanel } from "../components/TranscriptPanel/TranscriptPanel.js";
import { WatchAnywayJump } from "../components/WatchAnywayJump/WatchAnywayJump.js";
import type { ReaderTab } from "../types/ReaderTab.js";
import { noteSectionNames, overviewNoteLines } from "../util/overviewNoteLines.js";
import { overviewNeighbours } from "../util/overviewNeighbours.js";
import { overviewMetaParts } from "../../overviews/util/overviewMetaParts.js";
import { useReadAlong } from "./useReadAlong.js";
import { useMeasuredHeight } from "../../../util/useMeasuredHeight.js";
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
  const topicsQuery = useTopicsQuery();
  const setOverviewState = useSetOverviewStateMutation();
  const [tab, setTab] = useState<ReaderTab>("Overview");
  const [editingTopics, setEditingTopics] = useState(false);
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
  const { isPlus } = usePlan();
  const [plusPromptOpen, setPlusPromptOpen] = useState(false);
  const [playerDocked, setPlayerDocked] = useState(false);
  const savedLocallyNote = usePlusSavedLocallyNote(wasJustGenerated(useLocation().state));

  const overview = overviewQuery.data?.overview ?? null;
  const lines = useMemo(() => (overview ? overviewNoteLines(overview) : []), [overview]);
  const readAlong = useReadAlong(lines);

  // Design 16a: Listen is where the panel asks. On Plus it docks the player; on Free it
  // makes the case instead of playing, because playback is the thing being sold
  // (docs/features/plus-upsell.md). Docking is its own state rather than a read of
  // readAlong.playing: pausing from the bar must not take the bar away.
  const listen = () => {
    if (!isPlus) {
      setPlusPromptOpen(true);
      return;
    }
    if (playerDocked) {
      setPlayerDocked(false);
      if (readAlong.playing) readAlong.togglePlaying();
      return;
    }
    setPlayerDocked(true);
    if (!readAlong.playing) readAlong.togglePlaying();
  };

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

  if (overviewQuery.isError) {
    return (
      <div className={styles.state}>
        <p className={styles.error} data-testid={readerPageTestIds.error}>
          Couldn't load this overview: {overviewQuery.error.message}
        </p>
      </div>
    );
  }

  if (!overviewQuery.data || !overview) {
    return <ReaderNotFound />;
  }

  const { state } = overviewQuery.data;
  const topicNameById = new Map((topicsQuery.data ?? []).map((topic) => [topic.id, topic.name]));
  const topicNames = overview.topicIds
    .map((topicId) => topicNameById.get(topicId))
    .filter((name): name is string => name !== undefined);

  const neighbours = overviewNeighbours(
    orderOverviewsBySavedAt(libraryQuery.data ?? []),
    overviewId,
  );
  const metaParts = overviewMetaParts(overview);
  const range = overview.watchAnyway?.range ?? null;

  return (
    <article
      className={`${styles.root} ${isPanel ? styles.panelRoot : ""}`}
      ref={publishHeightsOn}
      data-testid={readerPageTestIds.root}
    >
      <ReaderMasthead
        overview={overview}
        topicNames={topicNames}
        metaParts={metaParts}
        neighbours={neighbours}
        read={state.read}
        playing={readAlong.playing}
        editingTopics={editingTopics}
        compact={isPanel}
        listening={playerDocked}
        // Measured only where it sticks: published on the wide reader it would push the
        // tab strip down by the height of a masthead that scrolls away.
        ref={isPanel ? readerMastheadHeight.measured : undefined}
        onToggleRead={() => setOverviewState.mutate({ overviewId, patch: { read: !state.read } })}
        onTogglePlaying={readAlong.togglePlaying}
        onListen={listen}
        onEditingTopicsChange={setEditingTopics}
      />

      {savedLocallyNote.shown && <PlusSavedLocallyNote onDismiss={savedLocallyNote.dismiss} />}

      <ReaderTabs
        active={tab}
        tabId={tabId}
        panelId={panelId}
        onChange={setTab}
        ref={tabsHeight.measured}
      />

      <div className={styles.grid}>
        <div
          key={tab}
          className={`${styles.main} ${styles.panel}`}
          role="tabpanel"
          id={panelId(tab)}
          aria-labelledby={tabId(tab)}
        >
          {tab === "Overview" && (
            <div data-testid={readerPageTestIds.overviewPanel}>
              <ReadAlongNote
                lines={lines}
                activeIndex={readAlong.activeIndex}
                onSelectLine={readAlong.selectLine}
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
          {tab === "Transcript" && <TranscriptPanel video={overview.video} />}
          {tab === "Chapters" && <ChaptersPanel />}
        </div>

        {!isPanel && (
          <ReaderRail
            sections={tab === "Overview" ? noteSectionNames(lines) : []}
            currentSection={readAlong.currentSection}
            onSelectSection={readAlong.selectSection}
            videoUrl={overview.video.url}
            sourceNote={overview.watchAnyway?.reason ?? null}
            jump={
              range
                ? {
                    label: `Jump to ${formatTimeRange(range.startMs, range.endMs)}`,
                    href: youtubeTimestampUrl(overview.video.url, range.startMs),
                  }
                : null
            }
          />
        )}
      </div>

      {plusPromptOpen && <PlusPrompt onDismiss={() => setPlusPromptOpen(false)} />}

      {(!isPanel || playerDocked) && (
        <ReaderPlayerBar
          playing={readAlong.playing}
          elapsed={readAlong.elapsed}
          total={readAlong.total}
          progressPercent={readAlong.progressPercent}
          rateLabel={readAlong.rateLabel}
          currentSection={readAlong.currentSection}
          favourite={state.favourite}
          onTogglePlaying={readAlong.togglePlaying}
          onPrevious={() => readAlong.step(-1)}
          onNext={() => readAlong.step(1)}
          onCycleRate={readAlong.cycleRate}
          onToggleFavourite={() =>
            setOverviewState.mutate({ overviewId, patch: { favourite: !state.favourite } })
          }
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
