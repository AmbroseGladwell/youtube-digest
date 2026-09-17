import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { OverviewId } from "@overview/types";
import { RouteParams, Routes } from "../../../app/Routes.js";
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
import type { ReaderTab } from "../types/ReaderTab.js";
import { noteSectionNames, overviewNoteLines } from "../util/overviewNoteLines.js";
import { overviewNeighbours } from "../util/overviewNeighbours.js";
import { overviewMetaParts } from "../../overviews/util/overviewMetaParts.js";
import { useReadAlong } from "./useReadAlong.js";
import { useMeasuredHeight } from "../../../util/useMeasuredHeight.js";
import styles from "./ReaderPage.module.scss";
import { readerPageTestIds } from "./ReaderPageTestIds.js";

const READER_TABS_HEIGHT_PROPERTY = "--reader-tabs-height";

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
  const tabsHeight = useMeasuredHeight<HTMLElement, HTMLDivElement>(READER_TABS_HEIGHT_PROPERTY);

  const overview = overviewQuery.data?.overview ?? null;
  const lines = useMemo(() => (overview ? overviewNoteLines(overview) : []), [overview]);
  const readAlong = useReadAlong(lines);

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

  const neighbours = overviewNeighbours(orderOverviewsBySavedAt(libraryQuery.data ?? []), overviewId);
  const metaParts = overviewMetaParts(overview);
  const range = overview.watchAnyway?.range ?? null;

  return (
    <article className={styles.root} ref={tabsHeight.host} data-testid={readerPageTestIds.root}>
      <ReaderMasthead
        overview={overview}
        topicNames={topicNames}
        metaParts={metaParts}
        neighbours={neighbours}
        read={state.read}
        playing={readAlong.playing}
        onToggleRead={() =>
          setOverviewState.mutate({ overviewId, patch: { read: !state.read } })
        }
        onTogglePlaying={readAlong.togglePlaying}
      />

      <ReaderTabs active={tab} tabId={tabId} panelId={panelId} onChange={setTab} ref={tabsHeight.measured} />

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
              <div className={styles.tagRow} data-testid={readerPageTestIds.tagRow}>
                {overview.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {tab === "Transcript" && <TranscriptPanel />}
          {tab === "Chapters" && <ChaptersPanel />}
        </div>

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
      </div>

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
