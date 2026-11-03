import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  NOVELTY_LABEL,
  SUMMARY_SECTION,
  overviewNoteCaptions,
  overviewNoteLines,
  formatClock,
  type SharePayload,
  sourceName,
} from "@overview/domain";
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
import { ArticleChaptersPanel } from "../../reader/components/ArticleChaptersPanel/ArticleChaptersPanel.js";
import { ArticleLineLinks } from "../../reader/components/ArticleLineLinks/ArticleLineLinks.js";
import { RecipeIngredients } from "../../reader/components/RecipeIngredients/RecipeIngredients.js";
import { RecipeMethod } from "../../reader/components/RecipeMethod/RecipeMethod.js";
import { RecipePageLink } from "../../reader/components/RecipePageLink/RecipePageLink.js";
import { RecipeTimes } from "../../reader/components/RecipeTimes/RecipeTimes.js";
import { initialScale, recipeAdjustment } from "../../reader/util/recipeAdjustment.js";
import { TranscriptPanel } from "../../reader/components/TranscriptPanel/TranscriptPanel.js";
import { ARTICLE_TABS, READER_TABS, type ReaderTab } from "../../reader/types/ReaderTab.js";
import { useNotePlayer } from "../../reader/ReaderPage/useNotePlayer.js";
import { useRecipeVoice } from "../../reader/ReaderPage/useRecipeVoice.js";
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
  const video = note.source.kind === "youtube" ? note.source : null;
  const webArticle =
    note.source.kind === "web" && note.article != null ? { source: note.source, article: note.article } : null;
  const recipePage = note.source.kind === "web" && note.recipe != null ? { source: note.source, recipe: note.recipe } : null;
  const tabsShown =
    recipePage !== null
      ? ["Overview" as const]
      : webArticle === null
        ? READER_TABS
        : webArticle.article.chapters.length > 1
          ? ARTICLE_TABS
          : ["Overview" as const];
  const recipeAsWritten = useMemo(
    () => (note.recipe == null ? null : recipeAdjustment(note.recipe, initialScale(note.recipe), "asWritten")),
    [note.recipe],
  );
  const [tab, setTab] = useState<ReaderTab>("Overview");
  const isPhone = useIsPhone();
  const [transcriptOpenAtMs, setTranscriptOpenAtMs] = useState<number | null>(null);

  const lines = useMemo(() => overviewNoteLines(note), [note]);
  const captions = useMemo(() => overviewNoteCaptions(note), [note]);
  const track = useMemo(() => playerTrackFor(note, lines), [note, lines]);
  const notePlayer = useNotePlayer(track);
  const recipeVoice = useRecipeVoice(track, lines, notePlayer);
  const summaryLines = useMemo(
    () => (note.recipe == null ? lines : lines.filter(({ section }) => section === SUMMARY_SECTION)),
    [lines, note.recipe],
  );
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

  const noteBarView = playerBarView(notePlayer.snapshot, notePlayer.time, { read: false });
  const barView =
    recipeVoice?.nowReading == null
      ? noteBarView
      : { ...noteBarView, label: { lead: "Now reading", rest: recipeVoice.nowReading, tone: "ink" as const, pacerTag: false } };

  return (
    <div className={styles.page} ref={publishHeightsOn} data-testid={sharedOverviewPageTestIds.root}>
      <SharedPageHeader ref={mastheadHeight.measured} />

      <div className={styles.body}>
        <main className={styles.main}>
          <div className={styles.head}>
            <div className={styles.chips}>
              <span className={styles.channel} data-testid={sharedOverviewPageTestIds.channel}>
                {note.source.kind === "youtube"
                  ? sourceName(note.source)
                  : `An overview of ${recipePage === null ? "an article" : "a recipe"} from ${sourceName(note.source)}`}
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
              {note.source.title}
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
                  title: note.source.title,
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
              href={note.source.url}
              target="_blank"
              rel="noopener"
              onClick={() => analytics.sharedPage.actions.watchOnYouTubeChosen()}
              data-testid={sharedOverviewPageTestIds.watchButton}
            >
              {note.source.kind === "youtube"
                ? "Watch on YouTube"
                : `${recipePage === null ? "Read the article" : "Open the recipe"} on ${sourceName(note.source)}`}
              <StrokeIcon name="openOut" size={16} />
            </a>
          </div>

          {tabsShown.length > 1 && (
            <ReaderTabs active={tab} tabId={tabId} panelId={panelId} onChange={changeTab} tabs={tabsShown} ref={tabsHeight.measured} />
          )}

          <div id={panelId(tab)} role="tabpanel" aria-labelledby={tabId(tab)}>
            {tab === "Overview" && (
              <div className={styles.note} data-testid={sharedOverviewPageTestIds.overviewPanel}>
                {recipePage !== null && <RecipeTimes recipe={recipePage.recipe} from={sourceName(recipePage.source)} />}
                <ReadAlongNote
                  lines={summaryLines}
                  captions={captions}
                  activeIndex={notePlayer.activeIndex}
                  speaking={notePlayer.playing}
                  onSelectLine={notePlayer.selectLine}
                  renderRange={(line, range, active) =>
                    video !== null && (
                      <LineRangeTag
                        line={line}
                        range={range}
                        video={video}
                        active={active}
                        asSheet={isPhone}
                        canReadTranscript={payload.snapshot.transcript !== null}
                        onOpenTranscriptAt={openTranscriptAt}
                      />
                    )
                  }
                  renderLineEnd={(line) =>
                    webArticle !== null ? (
                      <ArticleLineLinks line={line} onPage={null} {...webArticle} />
                    ) : (
                      recipePage !== null &&
                      line.section === SUMMARY_SECTION &&
                      !line.heading && <RecipePageLink source={recipePage.source} onPage={null} />
                    )
                  }
                />
                {/* Design 144u: the summary and the ingredients, and the method left on the
                    page, since it is in the author's own words. */}
                {recipePage !== null && recipeAsWritten !== null && (
                  <>
                    <RecipeIngredients
                      adjustment={recipeAsWritten}
                      scale={initialScale(recipePage.recipe)}
                      units="asWritten"
                      columns={!isPhone}
                      adjustable={false}
                      voice={recipeVoice?.ingredients ?? null}
                      onScaleChange={() => undefined}
                      onUnitsChange={() => undefined}
                      onReset={() => undefined}
                    />
                    <RecipeMethod recipe={recipePage.recipe} source={recipePage.source} note={null} voice={null} />
                  </>
                )}
                <RelatedByTag tags={note.tags} related={[]} tagsLink={false} />
              </div>
            )}
            {tab === "Transcript" && video !== null && (
              <TranscriptPanel
                video={video}
                held={transcript}
                openAtMs={transcriptOpenAtMs}
                openedFrom={openedFrom}
                onBackToChapters={() => changeTab("Chapters")}
              />
            )}
            {tab === "Chapters" && video !== null && (
              <ChaptersPanel
                chapters={note.chapters}
                video={video}
                held={transcript}
                onOpenTranscriptAt={openTranscriptAt}
              />
            )}
            {tab === "Chapters" && webArticle !== null && <ArticleChaptersPanel onPage={null} {...webArticle} />}
          </div>

        </main>

        <MakeYourOwnAside />
      </div>

      <ReaderPlayerBar
        view={barView}
        status={notePlayer.snapshot.status}
        time={notePlayer.time}
        lines={lines}
        lineStarts={notePlayer.snapshot.timings.lineStarts}
        durationSeconds={notePlayer.snapshot.timings.durationSeconds}
        favourite={null}
        canSignIn={false}
        onMain={() => {
          recipeVoice?.release();
          notePlayer.main();
        }}
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
