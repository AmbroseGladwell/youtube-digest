import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  adjustedText,
  DEFAULT_HEAD_IMAGE_SIZE,
  DEFAULT_NARRATION_VOICE,
  type RecipeUnits,
  type HeadImageSize,
  NOVELTY_LABEL,
  SUMMARY_SECTION,
  overviewNoteCaptions,
  overviewNoteLines,
  formatClock,
  recipeActions,
  type SharePayload,
  sourceName,
} from "@overview/domain";
import { Routes } from "../../../app/Routes.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useMeasuredHeight } from "../../../util/useMeasuredHeight.js";
import { CookingMode } from "../../reader/components/CookingMode/CookingMode.js";
import { ChaptersPanel } from "../../reader/components/ChaptersPanel/ChaptersPanel.js";
import { HeadImage } from "../../reader/components/HeadImage/HeadImage.js";
import { useHeadImageMotion } from "../../reader/components/ReaderMasthead/useHeadImageMotion.js";
import { ReadAlongNote } from "../../reader/components/ReadAlongNote/ReadAlongNote.js";
import { ReaderPlayerBar } from "../../reader/components/ReaderPlayerBar/ReaderPlayerBar.js";
import { ReaderTabs } from "../../reader/components/ReaderTabs/ReaderTabs.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { LineRangeTag, noteLineRange } from "../../reader/components/LineRangeTag/LineRangeTag.js";
import { RelatedByTag } from "../../reader/components/RelatedByTag/RelatedByTag.js";
import { ArticleChaptersPanel } from "../../reader/components/ArticleChaptersPanel/ArticleChaptersPanel.js";
import { ArticleLineLinks } from "../../reader/components/ArticleLineLinks/ArticleLineLinks.js";
import { RecipeIngredients } from "../../reader/components/RecipeIngredients/RecipeIngredients.js";
import { RecipeMethod } from "../../reader/components/RecipeMethod/RecipeMethod.js";
import { RecipePageLink } from "../../reader/components/RecipePageLink/RecipePageLink.js";
import { RecipeCookButton } from "../../reader/components/RecipeCookButton/RecipeCookButton.js";
import { RecipeTimes } from "../../reader/components/RecipeTimes/RecipeTimes.js";
import { initialScale, recipeAdjustment, type RecipeScale } from "../../reader/util/recipeAdjustment.js";
import { readRecipeUnits, writeRecipeUnits } from "../../reader/recipeUnitsStorage.js";
import { useNarrationApi } from "../../player/NarrationApiContext.js";
import { useSettingsQuery } from "../../settings/queries/settingsQuery.js";
import { sharedNarrationApi } from "../util/sharedNarrationApi.js";
import { TranscriptPanel } from "../../reader/components/TranscriptPanel/TranscriptPanel.js";
import { ARTICLE_TABS, READER_TABS, UNCHAPTERED_RECIPE_VIDEO_TABS, type ReaderTab } from "../../reader/types/ReaderTab.js";
import { useNotePlayer } from "../../reader/ReaderPage/useNotePlayer.js";
import { useCookingMode } from "../../reader/ReaderPage/useCookingMode.js";
import { useRecipeVoice } from "../../reader/ReaderPage/useRecipeVoice.js";
import { playerTrackFor } from "../../player/types/PlayerTrack.js";
import { playerBarView } from "../../player/util/playerBarView.js";
import { usePlayer } from "../../player/PlayerContext.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { MakeYourOwnAside } from "../components/MakeYourOwnAside/MakeYourOwnAside.js";
import { SharedOverviewGone } from "../components/SharedOverviewGone/SharedOverviewGone.js";
import { PageScrolledSentinel } from "../../../components/shared/PageScrolledSentinel/PageScrolledSentinel.js";
import { SharedPageHeader } from "../components/SharedPageHeader/SharedPageHeader.js";
import { SharedPlayerRuntime } from "../SharedPlayerRuntime.js";
import { startOnboardingFromShare } from "../../onboarding/useOnboardingProgress.js";
import { overviewWithStateQueryOptions } from "../../overviews/queries/overviewWithStateQuery.js";
import { useStores } from "../../../stores/StoresContext.js";
import { useSaveFromShare } from "../useSaveFromShare.js";
import { useSharedPageReader } from "../useSharedPageReader.js";
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
  const recipeNote = note.recipe != null ? { source: note.source, recipe: note.recipe } : null;
  const tabsShown =
    recipePage !== null
      ? ["Overview" as const]
      : webArticle === null
        ? recipeNote !== null && !note?.chapters?.length
          ? UNCHAPTERED_RECIPE_VIDEO_TABS
          : READER_TABS
        : webArticle.article.chapters.length > 1
          ? ARTICLE_TABS
          : ["Overview" as const];
  // Adjusted on the visitor's device, never in the copy, as on the reader's own page (OV-244).
  const [recipeScale, setRecipeScale] = useState<RecipeScale | null>(null);
  const [recipeUnits, setRecipeUnits] = useState<RecipeUnits>(readRecipeUnits);
  const chooseUnits = (units: RecipeUnits) => {
    setRecipeUnits(units);
    writeRecipeUnits(units);
  };
  const scale = recipeScale ?? (note.recipe == null ? null : initialScale(note.recipe));
  const adjustment = useMemo(
    () => (note.recipe == null || scale === null ? null : recipeAdjustment(note.recipe, scale, recipeUnits)),
    [note.recipe, scale, recipeUnits],
  );
  const shownIngredients = useMemo(() => adjustment?.lines.map(adjustedText) ?? [], [adjustment]);
  const adjusted = adjustment?.adjusted ?? false;
  const [tab, setTab] = useState<ReaderTab>("Overview");
  const isPhone = useIsPhone();
  const [transcriptOpenAtMs, setTranscriptOpenAtMs] = useState<number | null>(null);

  const lines = useMemo(
    () =>
      overviewNoteLines(
        note,
        adjustment === null || !adjusted
          ? {}
          : { ingredients: shownIngredients, units: recipeUnits, methodAmounts: adjustment.methodAmounts },
      ),
    [note, adjustment, adjusted, shownIngredients, recipeUnits],
  );
  const captions = useMemo(() => overviewNoteCaptions(note), [note]);
  const track = useMemo(() => playerTrackFor(note, lines), [note, lines]);
  const notePlayer = useNotePlayer(track);
  const methodActions = useMemo(() => (note.recipe == null ? [] : recipeActions(note.recipe.steps)), [note.recipe]);
  const recipeVoice = useRecipeVoice(track, lines, methodActions, note.recipe?.stepCount ?? 0, notePlayer);
  const summaryLines = useMemo(
    () => (note.recipe == null ? lines : lines.filter(({ section }) => section === SUMMARY_SECTION)),
    [lines, note.recipe],
  );
  const player = usePlayer();
  const { signedIn } = useSharedPageReader();
  // The copy's narration is the sharer's render of the recipe as written, so it plays only for
  // that. Adjusted, a signed-in visitor renders afresh on their own account; signed out, the
  // voice is the read-along without audio, and the page says an account reads it aloud (OV-244).
  const narration = payload.snapshot.narration;
  const sharedApi = useMemo(() => sharedNarrationApi(narration), [narration]);
  const accountApi = useNarrationApi();
  const accountVoice = useSettingsQuery().data?.narrationVoice ?? DEFAULT_NARRATION_VOICE;
  useEffect(() => {
    const own = adjusted && signedIn;
    player.setVoice(own ? accountVoice : (narration?.voice ?? DEFAULT_NARRATION_VOICE));
    player.setApi(!adjusted ? sharedApi : own ? accountApi : null);
  }, [player, adjusted, signedIn, sharedApi, accountApi, accountVoice, narration]);
  const navigate = useNavigate();
  const analytics = useAnalytics();
  const { overviewStore } = useStores();
  const held = useQuery({ ...overviewWithStateQueryOptions(overviewStore, note.id), enabled: signedIn });
  const saveFromShare = useSaveFromShare();
  const [saving, setSaving] = useState(false);
  const saveIntoAccount = async () => {
    setSaving(true);
    try {
      const saved = await saveFromShare(payload.token, payload.snapshot);
      await navigate(Routes.overview(saved.id));
    } finally {
      setSaving(false);
    }
  };
  const createAccount = () => {
    analytics.sharedPage.actions.saveChosen();
    startOnboardingFromShare(payload.token, payload.snapshot);
    void navigate(Routes.onboarding());
  };
  const saveAction =
    !signedIn
      ? { label: "Save to my overviews", onChoose: createAccount }
      : held.data != null
        ? {
            label: "Open in my overviews",
            onChoose: () => {
              analytics.sharedPage.actions.openChosen();
              void navigate(Routes.overview(note.id));
            },
          }
        : {
            label: saving ? "Saving…" : "Save to my overviews",
            onChoose: () => {
              analytics.sharedPage.actions.saveChosen();
              void saveIntoAccount();
            },
          };
  const cooking = useCookingMode({
    overviewId: note.id,
    title: note.source.title,
    steps: note.recipe?.steps ?? [],
    actions: methodActions,
    recipeVoice,
    snapshot: notePlayer.snapshot,
    analytics: analytics.sharedPage,
  });
  const cookable = recipeNote !== null && recipeNote.recipe.steps.length > 0 && recipeVoice !== null;
  const recipeCooking = !cookable
    ? null
    : {
        placeStep: cooking.place === null ? null : (methodActions[cooking.place.action]?.step ?? null),
        reachedStep: cooking.reachedStep,
        onStart: () => cooking.start("heading", 0),
        onCarryOn: () => cooking.start("carryOn", cooking.place?.action ?? 0),
      };
  const methodAction = recipeVoice?.methodAction ?? null;
  const cookFromHere = cookable && methodAction !== null ? () => cooking.start("bar", methodAction) : null;
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

  const [headImageSize, setHeadImageSize] = useState<HeadImageSize>(DEFAULT_HEAD_IMAGE_SIZE);
  const headImageFull = headImageSize === "full";
  const head = useRef<HTMLDivElement | null>(null);
  const image = useRef<HTMLButtonElement | null>(null);
  const title = useRef<HTMLHeadingElement | null>(null);
  const chips = useRef<HTMLDivElement | null>(null);
  const captureBeforeResize = useHeadImageMotion(headImageFull, {
    header: head,
    image,
    title,
    who: () => (chips.current === null ? [] : [chips.current]),
  });
  const toggleHeadImage = () => {
    const size: HeadImageSize = headImageFull ? "small" : "full";
    captureBeforeResize();
    analytics.sharedPage.headImage.resized({ size });
    setHeadImageSize(size);
  };

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

  const openedFromChapterIndex =
    transcriptOpenAtMs === null || transcriptStep !== null || note.chapters === null
      ? -1
      : note.chapters.findIndex((chapter) => chapter.startMs === transcriptOpenAtMs);
  const openedFromChapter = note.chapters?.[openedFromChapterIndex];
  const openedFrom =
    openedFromChapter === undefined
      ? null
      : {
          number: openedFromChapterIndex + 1,
          title: openedFromChapter.title,
          startMs: openedFromChapter.startMs,
          endMs: openedFromChapter.endMs,
        };

  const noteBarView = playerBarView(notePlayer.snapshot, notePlayer.time, { read: false });
  const barView =
    recipeVoice?.nowReading == null
      ? noteBarView
      : { ...noteBarView, label: { lead: "Now reading", rest: recipeVoice.nowReading, tone: "ink" as const, pacerTag: false } };

  return (
    <div className={styles.page} ref={publishHeightsOn} data-testid={sharedOverviewPageTestIds.root}>
      <PageScrolledSentinel />
      <SharedPageHeader ref={mastheadHeight.measured} />

      <div className={`${styles.body} ${signedIn ? styles.bodyAlone : ""}`}>
        <main className={styles.main}>
          <div className={styles.head} ref={head}>
            <div className={`${styles.lead} ${headImageFull ? styles.leadFull : ""}`}>
              <HeadImage
                key={note.id}
                ref={image}
                source={note.source}
                full={headImageFull}
                className={styles.image}
                onToggle={toggleHeadImage}
              />
              <div className={styles.chips} ref={chips}>
                <span className={styles.channel} data-testid={sharedOverviewPageTestIds.channel}>
                  {note.source.kind === "youtube"
                    ? recipeNote === null
                      ? sourceName(note.source)
                      : `An overview of a recipe video from ${sourceName(note.source)}`
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
            </div>
            <h1 className={styles.title} ref={title} data-testid={sharedOverviewPageTestIds.title}>
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
              disabled={saving || (signedIn && held.isPending)}
              onClick={saveAction.onChoose}
              data-testid={sharedOverviewPageTestIds.saveButton}
            >
              {saveAction.label}
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
                ? recipeNote === null
                  ? "Watch on YouTube"
                  : "Open the video on YouTube"
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
                {recipeNote !== null && <RecipeTimes recipe={recipeNote.recipe} source={recipeNote.source} />}
                {recipeCooking !== null && (
                  <RecipeCookButton
                    placeStep={recipeCooking.placeStep}
                    onStart={() => cooking.start("summary", 0)}
                    onCarryOn={recipeCooking.onCarryOn}
                  />
                )}
                <ReadAlongNote
                  lines={summaryLines}
                  captions={captions}
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
                      recipeNote !== null &&
                      line.section === SUMMARY_SECTION &&
                      !line.heading && <RecipePageLink source={recipeNote.source} onPage={null} />
                    )
                  }
                />
                {recipeNote !== null && adjustment !== null && scale !== null && (
                  <>
                    <RecipeIngredients
                      adjustment={adjustment}
                      scale={scale}
                      units={recipeUnits}
                      columns={!isPhone}
                      adjustable={true}
                      voice={recipeVoice?.ingredients ?? null}
                      said={note.recipe?.ingredientsSaid ?? null}
                      onScaleChange={setRecipeScale}
                      onUnitsChange={chooseUnits}
                      onReset={() => {
                        setRecipeScale(null);
                        chooseUnits("asWritten");
                      }}
                    />
                    {adjusted && !signedIn && (
                      <p className={styles.adjustedVoice} data-testid={sharedOverviewPageTestIds.adjustedVoice}>
                        Read aloud plays the recipe as it was shared. To hear it read aloud as adjusted,{" "}
                        <button
                          type="button"
                          className={styles.adjustedVoiceAccount}
                          onClick={createAccount}
                          data-testid={sharedOverviewPageTestIds.adjustedVoiceAccount}
                        >
                          create an account
                        </button>
                        .
                      </p>
                    )}
                    <RecipeMethod
                      recipe={recipeNote.recipe}
                      actions={methodActions}
                      source={recipeNote.source}
                      note={adjustment.methodNote}
                      voice={recipeVoice?.method ?? null}
                      cooking={recipeCooking}
                      stacked={isPhone}
                      usTemperatures={recipeUnits === "us"}
                      methodAmounts={adjustment.methodAmounts}
                      renderMoment={(step) => {
                        const range = recipeNote.recipe.steps[step]?.range;
                        return (
                          video !== null &&
                          range !== undefined && (
                            <LineRangeTag
                              kind="recipeStep"
                              about={recipeNote.recipe.steps[step]!.text}
                              step={step + 1}
                              range={range}
                              video={video}
                              active={false}
                              asSheet={isPhone}
                              canReadTranscript={payload.snapshot.transcript !== null}
                              onOpenTranscriptAt={(positionMs) => openTranscriptAt(positionMs, step + 1)}
                            />
                          )
                        );
                      }}
                    />
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
                openedFromStep={transcriptStep}
                onBackToChapters={() => changeTab("Chapters")}
              />
            )}
            {tab === "Chapters" && video !== null && (
              <ChaptersPanel
                chapters={note.chapters}
                video={video}
                held={transcript}
                onOpenTranscriptAt={openTranscriptAt}
                steps={note.recipe?.steps ?? []}
              />
            )}
            {tab === "Chapters" && webArticle !== null && <ArticleChaptersPanel onPage={null} {...webArticle} />}
          </div>

        </main>

        {!signedIn && <MakeYourOwnAside />}
      </div>

      {cookable && adjustment !== null && scale !== null && (
        <CookingMode
          mode={cooking}
          title={recipeNote.source.title}
          from={sourceName(recipeNote.source)}
          steps={recipeNote.recipe.steps}
          actions={methodActions}
          actionNote={adjustment.actionNote}
          surface={isPhone ? "phone" : "web"}
          usTemperatures={recipeUnits === "us"}
          methodAmounts={adjustment.methodAmounts}
          videoId={video?.id ?? null}
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
                said={note.recipe?.ingredientsSaid ?? null}
                onScaleChange={setRecipeScale}
                onUnitsChange={chooseUnits}
                onReset={() => undefined}
              />
            </>
          }
        />
      )}

      <ReaderPlayerBar
        onCookFromHere={cookFromHere}
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
          notePlayer.main("playerBar");
        }}
        onSkip={(delta) => player.skip(delta)}
        onSeek={(seconds) => player.seek(seconds)}
        onCycleRate={() => player.cycleRate()}
        onAction={(action) => {
          if (action === "readAlong" || action === "readAlongInstead" || action === "readAlongMeanwhile") {
            player.readAlong();
          }
          if (action === "tryAgain") notePlayer.play("playerBar");
        }}
        onReRecord={() => undefined}
      />
    </div>
  );
}
