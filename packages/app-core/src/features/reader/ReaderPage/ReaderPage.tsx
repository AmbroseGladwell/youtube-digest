import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import {
  KEY_POINTS_SECTION,
  OverviewId,
  SUMMARY_SECTION,
  adjustedText,
  recipeFrom,
  recipeText,
  sourceName,
  type RecipeUnits,
  isUnreadableRecordError,
  overviewMetaParts,
  overviewNoteCaptions,
  overviewNoteLines,
  overviewTimeSaved,
  formatClock,
  recipeActions as actionsOf,
} from "@overview/domain";
import { useIsPanel } from "../../../app/LayoutContext.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { RouteParams, Routes } from "../../../app/Routes.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { oneTimeAccessHost, wasAlreadyMade, wasJustGenerated } from "../../newOverview/justGenerated.js";
import { useStartArticleRun } from "../../newOverview/useStartArticleRun.js";
import { SavedLocallyNote } from "../../plus/components/SavedLocallyNote/SavedLocallyNote.js";
import { useSavedLocallyNote } from "../../plus/useSavedLocallyNote.js";
import { useDeleteOverviewMutation } from "../../overviews/mutations/useDeleteOverviewMutation.js";
import { useSetOverviewStateMutation } from "../../overviews/mutations/useSetOverviewStateMutation.js";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { useOverviewWithStateQuery } from "../../overviews/queries/overviewWithStateQuery.js";
import { useOverviewsWithStateQuery } from "../../overviews/queries/overviewsWithStateQuery.js";
import { libraryViewFromState } from "../../library/util/libraryViewState.js";
import { CaptureReasonLine } from "../components/CaptureReasonLine/CaptureReasonLine.js";
import { ChaptersPanel } from "../components/ChaptersPanel/ChaptersPanel.js";
import { DeleteOverviewDialog } from "../components/DeleteOverviewDialog/DeleteOverviewDialog.js";
import { NoteEndActions } from "../components/NoteEndActions/NoteEndActions.js";
import { ReadAlongNote } from "../components/ReadAlongNote/ReadAlongNote.js";
import { ReaderMasthead } from "../components/ReaderMasthead/ReaderMasthead.js";
import { ReaderPlayerBar } from "../components/ReaderPlayerBar/ReaderPlayerBar.js";
import { ArticleChaptersPanel } from "../components/ArticleChaptersPanel/ArticleChaptersPanel.js";
import { ArticleLineLinks } from "../components/ArticleLineLinks/ArticleLineLinks.js";
import { ReaderNotice } from "../components/ReaderNotice/ReaderNotice.js";
import { RegenerateArticleDialog } from "../components/RegenerateArticleDialog/RegenerateArticleDialog.js";
import { useShowOnPage } from "../useShowOnPage.js";
import { ReaderTabs } from "../components/ReaderTabs/ReaderTabs.js";
import { CookingMode } from "../components/CookingMode/CookingMode.js";
import { RecipeIngredients } from "../components/RecipeIngredients/RecipeIngredients.js";
import { RecipeMethod } from "../components/RecipeMethod/RecipeMethod.js";
import { RecipePageLink } from "../components/RecipePageLink/RecipePageLink.js";
import { RecipePrintSheet } from "../components/RecipePrintSheet/RecipePrintSheet.js";
import { RecipeCookButton } from "../components/RecipeCookButton/RecipeCookButton.js";
import { RecipeTimes } from "../components/RecipeTimes/RecipeTimes.js";
import { readRecipeUnits, writeRecipeUnits } from "../recipeUnitsStorage.js";
import { initialScale, recipeAdjustment, type RecipeScale } from "../util/recipeAdjustment.js";
import { useCookingMode } from "./useCookingMode.js";
import { useRecipeVoice } from "./useRecipeVoice.js";
import { ShareOverviewDialog } from "../../shares/components/ShareOverviewDialog/ShareOverviewDialog.js";
import { useShareOverviewMutation } from "../../shares/mutations/useShareOverviewMutation.js";
import { useStopSharingMutation } from "../../shares/mutations/useStopSharingMutation.js";
import { useOverviewShare } from "../../shares/useOverviewShare.js";
import { UnreadableOverview } from "../components/UnreadableOverview/UnreadableOverview.js";
import { TranscriptPanel } from "../components/TranscriptPanel/TranscriptPanel.js";
import { LineRangeTag, noteLineRange } from "../components/LineRangeTag/LineRangeTag.js";
import { usePlayingStep } from "./usePlayingStep.js";
import { useSeekPlayback } from "../../../app/PlaybackContext.js";
import { RelatedByTag } from "../components/RelatedByTag/RelatedByTag.js";
import { OnboardingNextSteps } from "../../onboarding/components/OnboardingNextSteps/OnboardingNextSteps.js";
import { readableEntries } from "../../overviews/types/LibraryEntry.js";
import { overviewTags } from "../../overviews/util/overviewTags.js";
import { relatedByTag } from "../util/relatedByTag.js";
import { ARTICLE_TABS, READER_TABS, UNCHAPTERED_RECIPE_VIDEO_TABS, type ReaderTab } from "../types/ReaderTab.js";
import { overviewNeighbours } from "../util/overviewNeighbours.js";
import { useNotePlayer } from "./useNotePlayer.js";
import { useSavedOnRead } from "./useSavedOnRead.js";
import { usePlayer } from "../../player/PlayerContext.js";
import { playerTrackFor } from "../../player/types/PlayerTrack.js";
import { playerBarView } from "../../player/util/playerBarView.js";
import { useSync } from "../../sync/SyncContext.js";
import { useOverviewInWebApp } from "../../sync/useOverviewInWebApp.js";
import { useMeasuredHeight } from "../../../util/useMeasuredHeight.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { bindOverviewId } from "../../analytics/bindOverviewId.js";
import { OverviewAnalyticsProvider } from "../../analytics/OverviewAnalyticsContext.js";
import { useShouldAnimateNavigation } from "../../../util/viewTransitions.js";
import { useHowToApplySlot } from "./useHowToApplySlot.js";
import styles from "./ReaderPage.module.scss";
import { readerPageTestIds } from "./ReaderPageTestIds.js";
import { PageLink } from "../../../components/shared/PageLink/PageLink.js";

const READER_TABS_HEIGHT_PROPERTY = "--reader-tabs-height";

const madeOn = (savedAt: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(savedAt));

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
  const [explainingRegenerate, setExplainingRegenerate] = useState(false);
  const [recipeScale, setRecipeScale] = useState<RecipeScale | null>(null);
  const [recipeUnits, setRecipeUnits] = useState<RecipeUnits>(readRecipeUnits);
  const [printingRecipe, setPrintingRecipe] = useState(false);
  const [recipeCopied, setRecipeCopied] = useState(false);
  const tabsHeight = useMeasuredHeight<HTMLElement, HTMLDivElement>(READER_TABS_HEIGHT_PROPERTY);
  const isPanel = useIsPanel();
  const isPhone = useIsPhone();

  const [playerDocked, setPlayerDocked] = useState(false);
  const location = useLocation();
  const savedLocallyNote = useSavedLocallyNote(wasJustGenerated(location.state));
  const onetimeHost = oneTimeAccessHost(location.state);
  const savedPhase = useSavedOnRead(overviewId, overviewQuery.data?.state.read);
  // The chip comes in where the reader is looking: above the end of the note when marked
  // read from there, in the head from anywhere else (docs/features/time-saved.md).
  const [readAtNoteEnd, setReadAtNoteEnd] = useState(false);

  // A chapter opens the transcript at its start; choosing the tab yourself opens it at
  // the top, so the target is cleared by every other route to it.
  const changeTab = (next: ReaderTab) => {
    setTranscriptOpenAtMs(null);
    setTab(next);
  };
  const [transcriptStep, setTranscriptStep] = useState<number | null>(null);
  const openTranscriptAt = (positionMs: number, step: number | null = null) => {
    setTranscriptOpenAtMs(positionMs);
    setTranscriptStep(step);
    setTab("Transcript");
  };

  // The line lives on the Overview tab, so asking to edit it from any other tab brings
  // that tab back first.
  const editReason = () => {
    changeTab("Overview");
    setEditingReason(true);
  };

  const overview = overviewQuery.data?.overview ?? null;
  const video = overview?.source.kind === "youtube" ? overview.source : null;
  const webArticle =
    overview?.source.kind === "web" && overview.article !== null ? { source: overview.source, article: overview.article } : null;
  const recipe = overview?.recipe ?? null;
  const recipePage = overview?.source.kind === "web" && recipe !== null ? { source: overview.source, recipe } : null;
  const recipeNote = overview !== null && recipe !== null ? { source: overview.source, recipe } : null;
  const webPage = webArticle?.source ?? recipePage?.source ?? null;
  const tabsShown =
    recipePage !== null
      ? ["Overview" as const]
      : webArticle === null
        ? recipeNote !== null && !overview?.chapters?.length
          ? UNCHAPTERED_RECIPE_VIDEO_TABS
          : READER_TABS
        : webArticle.article.chapters.length > 1
          ? ARTICLE_TABS
          : ["Overview" as const];
  useEffect(() => setRecipeScale(null), [overviewId]);
  const scale = recipeScale ?? (recipe === null ? null : initialScale(recipe));
  const adjustment = useMemo(
    () => (recipe === null || scale === null ? null : recipeAdjustment(recipe, scale, recipeUnits)),
    [recipe, scale, recipeUnits],
  );
  const shownIngredients = useMemo(() => adjustment?.lines.map(adjustedText) ?? [], [adjustment]);
  // A recipe is narrated as shown, so adjusted amounts are what is heard (OV-148).
  const lines = useMemo(
    () =>
      overview
        ? overviewNoteLines(
            overview,
            recipe === null ? {} : { ingredients: shownIngredients, units: recipeUnits, methodAmounts: adjustment?.methodAmounts ?? [] },
          )
        : [],
    [overview, recipe, shownIngredients, recipeUnits, adjustment],
  );
  const playingStep = usePlayingStep(recipe?.steps ?? [], video?.id ?? null);
  const seekVideo = useSeekPlayback(video?.id ?? null);
  const methodActions = useMemo(() => (recipe === null ? [] : actionsOf(recipe.steps)), [recipe]);
  const summaryLines = useMemo(
    () => (recipe === null ? lines : lines.filter(({ section }) => section === SUMMARY_SECTION)),
    [lines, recipe],
  );
  const onPage = useShowOnPage(webPage);
  const besideArticle = onPage !== null;
  const startArticleRun = useStartArticleRun();
  const captions = useMemo(() => {
    const written = overview ? overviewNoteCaptions(overview) : {};
    return besideArticle && written[KEY_POINTS_SECTION] !== undefined
      ? { ...written, [KEY_POINTS_SECTION]: "Chapter links move the article beside this panel to that place." }
      : written;
  }, [overview, besideArticle]);
  const howToApplySlot = useHowToApplySlot(overview);
  const regenerate =
    webPage === null
      ? null
      : {
          asksFirst: onPage === null,
          onChoose: () => {
            if (onPage === null) {
              setExplainingRegenerate(true);
              return;
            }
            startArticleRun(onPage.beside, { from: "regenerate", overviewId, willAsk: true });
            void navigate(Routes.home(), { viewTransition: animateNavigation });
          },
        };
  const track = useMemo(() => (overview ? playerTrackFor(overview, lines) : null), [overview, lines]);
  const notePlayer = useNotePlayer(track);
  const player = usePlayer();
  const recipeVoice = useRecipeVoice(track, lines, methodActions, recipe?.stepCount ?? 0, notePlayer);
  useEffect(() => {
    if (!recipeCopied) return;
    const hide = window.setTimeout(() => setRecipeCopied(false), 4000);
    return () => window.clearTimeout(hide);
  }, [recipeCopied]);
  const endPrinting = useCallback(() => setPrintingRecipe(false), []);
  const sync = useSync();
  const webApp = useOverviewInWebApp(overviewId);
  const overviewShare = useOverviewShare(overview);
  const shareOverview = useShareOverviewMutation();
  const stopSharing = useStopSharingMutation();
  const analytics = useAnalytics();
  const reader = useMemo(() => bindOverviewId(analytics.reader, overviewId), [analytics, overviewId]);
  const overviewAnalytics = useMemo(() => ({ page: reader, reader }), [reader]);
  const cooking = useCookingMode({
    overviewId,
    title: overview?.source.title ?? "",
    steps: recipe?.steps ?? [],
    actions: methodActions,
    recipeVoice,
    snapshot: notePlayer.snapshot,
    analytics: reader,
  });

  const opened = useRef<string | null>(null);
  const loaded = overviewQuery.data ?? null;
  useEffect(() => {
    if (loaded === null || opened.current === overviewId) return;
    opened.current = overviewId;
    reader.page.opened({
      answer: loaded.overview.watchAnyway?.answer ?? "none",
      novelty: loaded.overview.verdict?.novelty ?? "none",
      dubious: loaded.overview.verdict?.dubious ?? false,
      read: loaded.state.read,
      favourite: loaded.state.favourite,
    });
  }, [loaded, overviewId, reader]);

  // Design 2d: the panel's Listen plays straight away and docks the bar; the Plus prompt
  // it used to raise is retired, since audio is open to every account
  // (docs/features/audio-player.md). Docking is its own state rather than a read of
  // playing: pausing from the bar must not take the bar away.
  const listen = () => {
    recipeVoice?.release();
    reader.overview.listenPressed({ listening: !playerDocked });
    if (playerDocked) {
      setPlayerDocked(false);
      notePlayer.pause();
      return;
    }
    setPlayerDocked(true);
    if (!notePlayer.playing) notePlayer.play("masthead");
  };

  // Design 2: [ and ] step a line, now that the transport's arrows move fifteen seconds.
  const { stepLine } = notePlayer;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "[" && event.key !== "]") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      reader.page.lineStepped({ direction: event.key === "]" ? "next" : "previous" });
      stepLine(event.key === "]" ? 1 : -1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepLine, reader]);

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
      <ErrorState screen="overviewLoad"
        title="Couldn't load this overview"
        error={overviewQuery.error}
        body="Something went wrong reading it. Nothing has been lost."
        action={{ label: "Try again", onSelect: () => void overviewQuery.refetch() }}
        back
      />
    );
  }

  if (!overviewQuery.data || !overview) {
    // The copy made here was folded into the account's while this page was open
    // (docs/features/one-overview-per-video.md).
    const folded = sync.folds.find((fold) => fold.from === overviewId);
    if (folded !== undefined) {
      return <Navigate to={Routes.overview(folded.into)} replace />;
    }
    return <ReaderNotFound />;
  }

  const { state } = overviewQuery.data;
  const openedFromChapterIndex =
    transcriptOpenAtMs === null || transcriptStep !== null || overview.chapters === null
      ? -1
      : overview.chapters.findIndex((chapter) => chapter.startMs === transcriptOpenAtMs);
  const openedFromChapter = overview.chapters?.[openedFromChapterIndex];
  const openedFrom =
    openedFromChapter === undefined
      ? null
      : {
          number: openedFromChapterIndex + 1,
          title: openedFromChapter.title,
          startMs: openedFromChapter.startMs,
          endMs: openedFromChapter.endMs,
        };
  const toggleFavourite = (from: "masthead" | "playerBar" | "noteEnd") => {
    reader.overview.favouriteSwitched({ favourite: !state.favourite, from });
    setOverviewState.mutate({ overviewId, patch: { favourite: !state.favourite } });
  };
  const toggleRead = (from: "masthead" | "actionsMenu" | "noteEnd") => {
    if (!state.read) setReadAtNoteEnd(from === "noteEnd");
    reader.overview.readSwitched({ read: !state.read, from });
    setOverviewState.mutate({ overviewId, patch: { read: !state.read } });
  };
  const steppedView = libraryViewFromState(location.state);
  const neighbours = overviewNeighbours(libraryQuery.data ?? [], overviewId, steppedView);
  const steppingState = steppedView?.stepOn(overviewId);
  const timeSaved = overviewTimeSaved(overview);
  const savedChip =
    savedPhase !== "hidden" && timeSaved.kind === "counted" && timeSaved.minutes > 0
      ? { minutes: timeSaved.minutes, leaving: savedPhase === "leaving" }
      : null;
  // While the narration is in a recipe's list, the bar says where (design 144t).
  const noteBarView = playerBarView(notePlayer.snapshot, notePlayer.time, { read: state.read });
  const barView =
    recipeVoice?.nowReading == null
      ? noteBarView
      : { ...noteBarView, label: { lead: "Now reading", rest: recipeVoice.nowReading, tone: "ink" as const, pacerTag: false } };
  const recipeActions =
    recipeNote === null || adjustment === null
      ? null
      : {
          onCopy: () => {
            const from = recipeFrom(recipeNote.source);
            void navigator.clipboard
              .writeText(
                recipeText({
                  title: recipeNote.source.title,
                  from,
                  url: recipeNote.source.url,
                  recipe: recipeNote.recipe,
                  ingredients: shownIngredients,
                  adjusted: adjustment.copyNote,
                  methodAmounts: adjustment.methodAmounts,
                }),
              )
              .then(() => setRecipeCopied(true));
          },
          onPrint: () => setPrintingRecipe(true),
        };
  const cookable = recipeNote !== null && recipeNote.recipe.steps.length > 0 && recipeVoice !== null;
  const cookFrom = cooking.place;
  const recipeCooking = !cookable
    ? null
    : {
        placeStep: cookFrom === null ? null : (methodActions[cookFrom.action]?.step ?? null),
        reachedStep: cooking.reachedStep,
        onStart: () => cooking.start("heading", 0),
        onCarryOn: () => cooking.start("carryOn", cookFrom?.action ?? 0),
      };
  const methodAction = recipeVoice?.methodAction ?? null;
  const cookFromHere = cookable && methodAction !== null ? () => cooking.start("bar", methodAction) : null;
  const chooseUnits = (units: RecipeUnits) => {
    setRecipeUnits(units);
    writeRecipeUnits(units);
  };
  const confirmDelete = () => {
    reader.deleteDialog.confirmed();
    setConfirmingDelete(false);
    deleteOverview.mutate({ overviewId });
    void navigate(Routes.home(), { replace: true, viewTransition: animateNavigation });
  };

  return (
    <OverviewAnalyticsProvider value={overviewAnalytics}>
      <article
        className={`${styles.root} ${isPanel ? styles.panelRoot : ""}`}
        ref={tabsHeight.host}
        data-testid={readerPageTestIds.root}
      >
        <ReaderMasthead
          overview={overview}
          metaParts={overviewMetaParts(overview)}
          savedChip={readAtNoteEnd ? null : savedChip}
          read={state.read}
          favourite={state.favourite}
          playing={notePlayer.playing}
          editingTopics={editingTopics}
          compact={isPanel}
          webApp={webApp}
          listening={playerDocked}
          onToggleRead={toggleRead}
          onToggleFavourite={() => toggleFavourite("masthead")}
          onTogglePlaying={() => {
            reader.overview.listenPressed({ listening: !notePlayer.playing });
            recipeVoice?.release();
            notePlayer.main("masthead");
          }}
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
          regenerate={regenerate}
          recipeActions={recipeActions}
          onDelete={() => setConfirmingDelete(true)}
        />

        {wasAlreadyMade(location.state) && <ReaderNotice>You made an overview of this on {madeOn(overview.savedAt)}.</ReaderNotice>}

        {savedLocallyNote.shown && <SavedLocallyNote onDismiss={savedLocallyNote.dismiss} />}

        {recipeCopied && recipeNote !== null && (
          <ReaderNotice>
            <span role="status">
              Recipe copied, with a link to {recipeNote.source.kind === "youtube" ? "the video" : sourceName(recipeNote.source)}
            </span>
          </ReaderNotice>
        )}

        {tabsShown.length > 1 && (
          <ReaderTabs
            active={tab}
            tabId={tabId}
            panelId={panelId}
            onChange={changeTab}
            tabs={tabsShown}
            ref={tabsHeight.measured}
          />
        )}

        <div
          key={tab}
          className={`${styles.main} ${styles.panel}`}
          role="tabpanel"
          id={panelId(tab)}
          aria-labelledby={tabId(tab)}
        >
          {tab === "Overview" && (
            <div className={styles.note} data-testid={readerPageTestIds.overviewPanel}>
              {recipeNote !== null && <RecipeTimes recipe={recipeNote.recipe} source={recipeNote.source} />}
              <CaptureReasonLine
                overview={overview}
                editing={editingReason}
                compact={isPanel}
                onEditingChange={setEditingReason}
              />
              {recipeCooking !== null && (
                <RecipeCookButton
                  placeStep={recipeCooking.placeStep}
                  onStart={() => cooking.start("summary", 0)}
                  onCarryOn={recipeCooking.onCarryOn}
                />
              )}
              <ReadAlongNote
                key={overviewId}
                lines={summaryLines}
                captions={captions}
                sectionSlot={howToApplySlot}
                activeIndex={notePlayer.activeIndex}
                speaking={notePlayer.playing}
                onSelectLine={notePlayer.selectLine}
                renderRange={(line, range, active) =>
                  video !== null && (
                    <LineRangeTag
                      {...noteLineRange(line)}
                      range={range}
                      video={video}
                      active={active}
                      asSheet={isPhone && !isPanel}
                      canReadTranscript={true}
                      onOpenTranscriptAt={openTranscriptAt}
                    />
                  )
                }
                renderLineEnd={(line) =>
                  webArticle !== null ? (
                    <ArticleLineLinks line={line} {...webArticle} onPage={onPage} />
                  ) : (
                    recipeNote !== null &&
                    line.section === SUMMARY_SECTION &&
                    !line.heading && <RecipePageLink source={recipeNote.source} onPage={onPage} />
                  )
                }
              />
              {recipeNote !== null && adjustment !== null && scale !== null && (
                <>
                  <RecipeIngredients
                    adjustment={adjustment}
                    scale={scale}
                    units={recipeUnits}
                    columns={!isPanel && !isPhone}
                    adjustable={true}
                    voice={recipeVoice?.ingredients ?? null}
                    said={recipe?.ingredientsSaid ?? null}
                    onScaleChange={setRecipeScale}
                    onUnitsChange={chooseUnits}
                    onReset={() => {
                      setRecipeScale(null);
                      chooseUnits("asWritten");
                    }}
                  />
                  <RecipeMethod
                    recipe={recipeNote.recipe}
                    actions={methodActions}
                    source={recipeNote.source}
                    note={adjustment.methodNote}
                    voice={recipeVoice?.method ?? null}
                    cooking={recipeCooking}
                    stacked={isPhone && !isPanel}
                    usTemperatures={recipeUnits === "us"}
                    methodAmounts={adjustment.methodAmounts}
                    playingStep={playingStep}
                    renderMoment={(step) => {
                      const range = recipeNote.recipe.steps[step]?.range;
                      return (
                        video !== null &&
                        range !== undefined && (
                          <LineRangeTag
                            kind="recipeStep"
                            about={recipeNote.recipe.steps[step]!.text}
                            step={step + 1}
                            playing={playingStep === step}
                            range={range}
                            video={video}
                            active={false}
                            asSheet={isPhone && !isPanel}
                            canReadTranscript={true}
                            onOpenTranscriptAt={(positionMs) => openTranscriptAt(positionMs, step + 1)}
                          />
                        )
                      );
                    }}
                  />
                </>
              )}
              {onetimeHost !== null && (
                <ReaderNotice>Read with one-time access. The Create button on {onetimeHost} will ask Chrome once.</ReaderNotice>
              )}
              <NoteEndActions
                read={state.read}
                favourite={state.favourite}
                savedChip={readAtNoteEnd ? savedChip : null}
                onToggleRead={() => toggleRead("noteEnd")}
                onToggleFavourite={() => toggleFavourite("noteEnd")}
              />
              <OnboardingNextSteps overviewId={overview.id} />
              <RelatedByTag
                tags={overviewTags(overviewQuery.data)}
                related={relatedByTag(overviewQuery.data, readableEntries(libraryQuery.data ?? []))}
                tagsLink={!isPanel}
                onTagFollowed={() => reader.relatedByTag.tagFollowed()}
                onOverviewOpened={(sharedTags) => reader.relatedByTag.overviewOpened({ sharedTags })}
                onMoreShown={(shown) => reader.relatedByTag.moreShown({ shown })}
              />
            </div>
          )}
          {tab === "Transcript" && video !== null && (
            <TranscriptPanel
              key={video.id}
              video={video}
              openAtMs={transcriptOpenAtMs}
              openedFrom={openedFrom}
              openedFromStep={transcriptStep}
              onBackToChapters={() => changeTab("Chapters")}
            />
          )}
          {tab === "Chapters" && video !== null && (
            <ChaptersPanel
              chapters={overview.chapters}
              video={video}
              onOpenTranscriptAt={openTranscriptAt}
              steps={recipe?.steps ?? []}
            />
          )}
          {tab === "Chapters" && webArticle !== null && <ArticleChaptersPanel {...webArticle} onPage={onPage} />}
        </div>

        {/* Where the library's order takes you next. At the foot rather than on the bar:
            the next note is a thing to want once this one is read (design 4a has no
            stepper, and the panel has no list to step through). */}
        {!isPanel && neighbours.position !== null && (
          <nav className={styles.foot} aria-label="Neighbouring overviews">
            {neighbours.previousId ? (
              <PageLink
                className={styles.stepLink}
                to={Routes.overview(neighbours.previousId)}
                state={steppingState}
                onClick={() => reader.page.neighbourFollowed({ direction: "previous" })}
                data-testid={readerPageTestIds.previousLink}
              >
                <StrokeIcon name="arrowLeft" />
                Previous
              </PageLink>
            ) : (
              <span />
            )}
            <span className={styles.position} data-testid={readerPageTestIds.position}>
              {neighbours.position} of {neighbours.total}
            </span>
            {neighbours.nextId ? (
              <PageLink
                className={styles.stepLink}
                to={Routes.overview(neighbours.nextId)}
                state={steppingState}
                onClick={() => reader.page.neighbourFollowed({ direction: "next" })}
                data-testid={readerPageTestIds.nextLink}
              >
                Next
                <StrokeIcon name="arrowRight" />
              </PageLink>
            ) : (
              <span />
            )}
          </nav>
        )}

        {confirmingDelete && (
          <DeleteOverviewDialog
            title={overview.source.title}
            onDelete={confirmDelete}
            onClose={() => {
              reader.deleteDialog.cancelled();
              setConfirmingDelete(false);
            }}
          />
        )}

        {explainingRegenerate && webPage !== null && (
          <RegenerateArticleDialog url={webPage.url} onClose={() => setExplainingRegenerate(false)} />
        )}

        {printingRecipe && recipeNote !== null && (
          <RecipePrintSheet
            source={recipeNote.source}
            from={recipeFrom(recipeNote.source)}
            recipe={recipeNote.recipe}
            lines={adjustment?.lines ?? []}
            methodAmounts={adjustment?.methodAmounts ?? []}
            adjusted={adjustment?.copyNote ?? null}
            onDone={endPrinting}
          />
        )}

        {cookable && adjustment !== null && scale !== null && (
          <CookingMode
            mode={cooking}
            title={recipeNote.source.title}
            from={sourceName(recipeNote.source)}
            steps={recipeNote.recipe.steps}
            actions={methodActions}
            actionNote={adjustment.actionNote}
            surface={isPanel ? "panel" : isPhone ? "phone" : "web"}
            usTemperatures={recipeUnits === "us"}
            methodAmounts={adjustment.methodAmounts}
            videoId={video?.id ?? null}
            seekVideo={seekVideo}
            ingredients={
              <>
                {adjustment.cookingNote !== null && <p className={styles.cookingAdjusted}>{adjustment.cookingNote}</p>}
                <RecipeIngredients
                  adjustment={adjustment}
                  scale={scale}
                  units={recipeUnits}
                  columns={false}
                  adjustable={false}
                  voice={null}
                  said={recipe?.ingredientsSaid ?? null}
                  onScaleChange={setRecipeScale}
                  onUnitsChange={chooseUnits}
                  onReset={() => undefined}
                />
              </>
            }
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
            status={notePlayer.snapshot.status}
            time={notePlayer.time}
            lines={lines}
            lineStarts={notePlayer.snapshot.timings.lineStarts}
            durationSeconds={notePlayer.snapshot.timings.durationSeconds}
            favourite={isPanel ? { on: state.favourite, onToggle: () => toggleFavourite("playerBar") } : null}
            canSignIn={sync.available}
            onMain={() => {
              recipeVoice?.release();
              notePlayer.main("playerBar");
            }}
            onSkip={(delta) => player.skip(delta)}
            onSeek={(seconds) => player.seek(seconds)}
            onCycleRate={() => player.cycleRate()}
            onAction={(action) => {
              if (action === "markRead") {
                setReadAtNoteEnd(false);
                reader.overview.readSwitched({ read: true, from: "playerBar" });
                setOverviewState.mutate({ overviewId, patch: { read: true } });
              } else if (action === "tryAgain") {
                notePlayer.play("playerBar");
              } else {
                player.readAlong();
              }
            }}
            onReRecord={() => player.reRecord()}
            onCookFromHere={cookFromHere}
          />
        )}
      </article>
    </OverviewAnalyticsProvider>
  );
}

function ReaderNotFound() {
  return (
    <div className={styles.state}>
      <p className={styles.error} data-testid={readerPageTestIds.notFound}>
        That overview isn't in your library.
      </p>
      <PageLink to={Routes.home()}>← All overviews</PageLink>
    </div>
  );
}
