import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { NOVELTY_LABEL, overviewNoteCaptions, overviewNoteLines, formatClock, type SharePayload } from "@overview/domain";
import { Routes } from "../../../app/Routes.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useMeasuredHeight } from "../../../util/useMeasuredHeight.js";
import { ChaptersPanel } from "../../reader/components/ChaptersPanel/ChaptersPanel.js";
import { ReadAlongNote } from "../../reader/components/ReadAlongNote/ReadAlongNote.js";
import { ReaderPlayerBar } from "../../reader/components/ReaderPlayerBar/ReaderPlayerBar.js";
import { ReaderTabs } from "../../reader/components/ReaderTabs/ReaderTabs.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { LineRangeTag } from "../../reader/components/LineRangeTag/LineRangeTag.js";
import { RelatedByTag } from "../../reader/components/RelatedByTag/RelatedByTag.js";
import { TranscriptPanel } from "../../reader/components/TranscriptPanel/TranscriptPanel.js";
import type { ReaderTab } from "../../reader/types/ReaderTab.js";
import { useNotePlayer } from "../../reader/ReaderPage/useNotePlayer.js";
import { playerTrackFor } from "../../player/types/PlayerTrack.js";
import { playerBarView } from "../../player/util/playerBarView.js";
import { usePlayer } from "../../player/PlayerContext.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { MakeYourOwnAside } from "../components/MakeYourOwnAside/MakeYourOwnAside.js";
import { SharedOverviewGone } from "../components/SharedOverviewGone/SharedOverviewGone.js";
import { SharedPageHeader } from "../components/SharedPageHeader/SharedPageHeader.js";
import { SharedPlayerRuntime } from "../SharedPlayerRuntime.js";
import { rememberSharedPageIntent } from "../util/sharedPageIntent.js";
import { sharedMetaParts } from "../util/sharedMetaParts.js";
import styles from "./SharedOverviewPage.module.scss";
import { sharedOverviewPageTestIds } from "./SharedOverviewPageTestIds.js";

const MASTHEAD_HEIGHT_PROPERTY = "--masthead-height";
const READER_TABS_HEIGHT_PROPERTY = "--reader-tabs-height";

const tabId = (tab: ReaderTab) => `shared-tab-${tab.toLowerCase()}`;
const panelId = (tab: ReaderTab) => `shared-panel-${tab.toLowerCase()}`;

export interface SharedOverviewPageProps {
  payload: SharePayload;
}

// Design 30e–30k: the reader's own layout, with none of the owner's controls, over a copy
// that arrived in the document (docs/features/sharing.md).
export function SharedOverviewPage({ payload }: SharedOverviewPageProps) {
  if (payload.state !== "shared") {
    return (
      <div className={styles.page}>
        <SharedPageHeader />
        <SharedOverviewGone state={payload.state} />
      </div>
    );
  }
  return (
    <SharedPlayerRuntime narration={payload.snapshot.narration}>
      <SharedOverview payload={payload} />
    </SharedPlayerRuntime>
  );
}

function SharedOverview({ payload }: { payload: Extract<SharePayload, { state: "shared" }> }) {
  const { note, transcript } = payload.snapshot;
  const [tab, setTab] = useState<ReaderTab>("Overview");
  const isPhone = useIsPhone();
  const [transcriptOpenAtMs, setTranscriptOpenAtMs] = useState<number | null>(null);

  const lines = useMemo(() => overviewNoteLines(note), [note]);
  const captions = useMemo(() => overviewNoteCaptions(note), [note]);
  const track = useMemo(() => playerTrackFor(note, lines), [note, lines]);
  const notePlayer = useNotePlayer(track);
  const player = usePlayer();
  const navigate = useNavigate();
  const analytics = useAnalytics();
  // Both are measured rather than assumed, because the read-along's scroll margin and the
  // tab strip's own offset are built from them (docs/features/overview-redesign.md).
  const mastheadHeight = useMeasuredHeight<HTMLDivElement, HTMLElement>(MASTHEAD_HEIGHT_PROPERTY);
  const tabsHeight = useMeasuredHeight<HTMLDivElement, HTMLDivElement>(READER_TABS_HEIGHT_PROPERTY);
  const publishHeightsOn = useCallback(
    (element: HTMLDivElement | null) => {
      mastheadHeight.host(element);
      tabsHeight.host(element);
    },
    [mastheadHeight.host, tabsHeight.host],
  );

  const changeTab = (next: ReaderTab) => {
    setTranscriptOpenAtMs(null);
    setTab(next);
  };
  const openTranscriptAt = (positionMs: number) => {
    setTranscriptOpenAtMs(positionMs);
    setTab("Transcript");
  };

  const openedFromChapterIndex =
    transcriptOpenAtMs === null || note.chapters === null
      ? -1
      : note.chapters.findIndex((chapter) => chapter.startMs === transcriptOpenAtMs);
  const openedFromChapter = note.chapters?.[openedFromChapterIndex];
  const openedFrom =
    openedFromChapter === undefined
      ? null
      : { number: openedFromChapterIndex + 1, title: openedFromChapter.title };

  const barView = playerBarView(notePlayer.snapshot, notePlayer.time, { read: false });

  return (
    <div className={styles.page} ref={publishHeightsOn} data-testid={sharedOverviewPageTestIds.root}>
      <SharedPageHeader ref={mastheadHeight.measured} />

      <div className={styles.body}>
        <main className={styles.main}>
          <div className={styles.head}>
            <div className={styles.chips}>
              <span className={styles.channel} data-testid={sharedOverviewPageTestIds.channel}>
                {note.video.channel}
              </span>
              {note.verdict !== null && (
                <span className={styles.chip} data-testid={sharedOverviewPageTestIds.noveltyChip}>
                  {NOVELTY_LABEL[note.verdict.novelty]}
                </span>
              )}
              {note.selling !== null && note.selling.type !== "none" && (
                <span className={styles.chip} data-testid={sharedOverviewPageTestIds.sellingChip}>
                  Sponsored segment
                </span>
              )}
            </div>
            <h1 className={styles.title} data-testid={sharedOverviewPageTestIds.title}>
              {note.video.title}
            </h1>
            <p className={styles.meta} data-testid={sharedOverviewPageTestIds.meta}>
              {sharedMetaParts(note, payload.sharedAt).join(" · ")}
            </p>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.surfaceAction}
              onClick={() => {
                analytics.sharedPage.actions.saveChosen();
                rememberSharedPageIntent({
                  kind: "save",
                  token: payload.token,
                  title: note.video.title,
                  snapshot: payload.snapshot,
                });
                void navigate(Routes.createAccount());
              }}
              data-testid={sharedOverviewPageTestIds.saveButton}
            >
              Save to my overviews
              <StrokeIcon name="bookmark" size={16} />
            </button>
            <a
              className={styles.surfaceAction}
              href={note.video.url}
              target="_blank"
              rel="noopener"
              onClick={() => analytics.sharedPage.actions.watchOnYouTubeChosen()}
              data-testid={sharedOverviewPageTestIds.watchButton}
            >
              Watch on YouTube
              <StrokeIcon name="openOut" size={16} />
            </a>
          </div>

          <ReaderTabs active={tab} tabId={tabId} panelId={panelId} onChange={changeTab} ref={tabsHeight.measured} />

          <div id={panelId(tab)} role="tabpanel" aria-labelledby={tabId(tab)}>
            {tab === "Overview" && (
              <div className={styles.note} data-testid={sharedOverviewPageTestIds.overviewPanel}>
                <ReadAlongNote
                  lines={lines}
                  captions={captions}
                  activeIndex={notePlayer.activeIndex}
                    onSelectLine={notePlayer.selectLine}
                  renderRange={(line, range, active) => (
                    <LineRangeTag
                      line={line}
                      range={range}
                      video={note.video}
                      active={active}
                      asSheet={isPhone}
                      canReadTranscript={payload.snapshot.transcript !== null}
                      onOpenTranscriptAt={openTranscriptAt}
                    />
                  )}
                />
                <RelatedByTag tags={note.tags} related={[]} tagsLink={false} />
              </div>
            )}
            {tab === "Transcript" && (
              <TranscriptPanel
                video={note.video}
                held={transcript}
                openAtMs={transcriptOpenAtMs}
                openedFrom={openedFrom}
                onBackToChapters={() => changeTab("Chapters")}
              />
            )}
            {tab === "Chapters" && (
              <ChaptersPanel
                chapters={note.chapters}
                video={note.video}
                held={transcript}
                onOpenTranscriptAt={openTranscriptAt}
              />
            )}
          </div>

        </main>

        <MakeYourOwnAside />
      </div>

      <ReaderPlayerBar
        view={barView}
        time={notePlayer.time}
        lines={lines}
        lineStarts={notePlayer.snapshot.timings.lineStarts}
        durationSeconds={notePlayer.snapshot.timings.durationSeconds}
        favourite={null}
        canSignIn={false}
        onMain={notePlayer.main}
        onSkip={(delta) => player.skip(delta)}
        onSeek={(seconds) => player.seek(seconds)}
        onCycleRate={() => player.cycleRate()}
        onAction={(action) => {
          if (action === "readAlong" || action === "readAlongInstead" || action === "readAlongMeanwhile") {
            player.readAlong();
          }
          if (action === "tryAgain") notePlayer.play();
        }}
        onReRecord={() => undefined}
      />
    </div>
  );
}
