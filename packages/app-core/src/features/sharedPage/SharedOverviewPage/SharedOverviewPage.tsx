import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useBlocker, useNavigate } from "react-router";
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
  recipeActions,
  type SharePayload,
  type Source,
  openPodcastLabel,
  sourceName,
  sourceUrl,
} from "@overview/domain";
import { Routes } from "../../../app/Routes.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useMeasuredHeight } from "../../../util/useMeasuredHeight.js";
import { CookingMode } from "../../reader/components/CookingMode/CookingMode.js";
import { ChaptersPanel } from "../../reader/components/ChaptersPanel/ChaptersPanel.js";
import { HeadImage } from "../../reader/components/HeadImage/HeadImage.js";
import { EpisodeArt } from "../../reader/components/EpisodeArt/EpisodeArt.js";
import { timedSource } from "../../reader/util/timedSource.js";
import { useEpisodeEngine } from "../../reader/episode/useEpisodeEngine.js";
import { TikTokPlayer } from "../../reader/components/TikTokPlayer/TikTokPlayer.js";
import { useTikTokEngine } from "../../reader/tiktok/useTikTokEngine.js";
import { useMediaQuery } from "../../../util/useMediaQuery.js";
import { EpisodePlayer } from "../../reader/components/EpisodePlayer/EpisodePlayer.js";
import { PlaybackProvider } from "../../../app/PlaybackContext.js";
import { useHeadImageMotion } from "../../reader/components/ReaderMasthead/useHeadImageMotion.js";
import { ReadAlongNote } from "../../reader/components/ReadAlongNote/ReadAlongNote.js";
import { ReaderPlayerBar } from "../../reader/components/ReaderPlayerBar/ReaderPlayerBar.js";
import { ReaderTabs } from "../../reader/components/ReaderTabs/ReaderTabs.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { LineRangeTag, noteLineRange } from "../../reader/components/LineRangeTag/LineRangeTag.js";
import { RelatedByTag } from "../../reader/components/RelatedByTag/RelatedByTag.js";
import { ArticleChaptersPanel } from "../../reader/components/ArticleChaptersPanel/ArticleChaptersPanel.js";
import { ArticleLineLinks } from "../../reader/components/ArticleLineLinks/ArticleLineLinks.js";
import { ArticleResources } from "../../reader/components/ArticleResources/ArticleResources.js";
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
import { SharedTranscriptPrompt } from "../components/SharedTranscriptPrompt/SharedTranscriptPrompt.js";
import { ARTICLE_TABS, timedSourceTabs, type ReaderTab } from "../../reader/types/ReaderTab.js";
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
import { CookingTimersRuntime } from "../../cookingTimers/CookingTimersRuntime.js";
import { CookingTimerDock } from "../../cookingTimers/components/CookingTimerDock/CookingTimerDock.js";
import { useTimersWillStop } from "../../cookingTimers/useTimersWillStop.js";
import { startOnboardingFromShare } from "../../onboarding/useOnboardingProgress.js";
import { overviewWithStateQueryOptions } from "../../overviews/queries/overviewWithStateQuery.js";
import { useStores } from "../../../stores/StoresContext.js";
import { useSaveFromShare } from "../useSaveFromShare.js";
import { useSharedPageReader } from "../useSharedPageReader.js";
import { sharedMetaParts } from "../util/sharedMetaParts.js";
import styles from "./SharedOverviewPage.module.scss";
import { sharedOverviewPageTestIds } from "./SharedOverviewPageTestIds.js";
import { stickyChromeSizes } from "../../../util/stickyChromeSizes.js";

const tabId = (tab: ReaderTab) => `shared-tab-${tab.toLowerCase()}`;
const panelId = (tab: ReaderTab) => `shared-panel-${tab.toLowerCase()}`;

export interface SharedOverviewPageProps {
  payload: SharePayload;
}

export const SharedOverviewPage = ({ payload }: SharedOverviewPageProps) => {
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
      <CookingTimersRuntime scope="sharedPage">
        <SharedOverview payload={payload} />
      </CookingTimersRuntime>
    </SharedPlayerRuntime>
  );
};

interface SaveAction {
  label: string;
  onChoose: () => void;
}

const WIDE_QUERY = "(min-width: 64rem)";

const tabsShownFor = (
  recipePage: boolean,
  articleChapterCount: number | null,
  noteChapterCount: number | null,
  recipeVideo: boolean,
): readonly ReaderTab[] => {
  if (recipePage) {
    return ["Overview"];
  }
  if (articleChapterCount === null) {
    return timedSourceTabs(noteChapterCount, recipeVideo);
  }
  return articleChapterCount > 1 ? ARTICLE_TABS : ["Overview"];
};

const channelLine = (source: Source, recipeVideo: boolean, recipePage: boolean): string => {
  if (source.kind === "youtube") {
    return recipeVideo ? `An overview of a recipe video from ${sourceName(source)}` : sourceName(source);
  }
  if (source.kind === "podcast") {
    return `An overview of an episode of ${source.showName}`;
  }
  if (source.kind === "tiktok") {
    return `An overview of a ${recipeVideo ? "recipe " : ""}TikTok from ${sourceName(source)}`;
  }
  return `An overview of ${recipePage ? "a recipe" : "an article"} from ${sourceName(source)}`;
};

const sourceLinkLabel = (source: Source, recipeVideo: boolean, recipePage: boolean): string => {
  if (source.kind === "youtube") {
    return recipeVideo ? "Open the video on YouTube" : "Watch on YouTube";
  }
  if (source.kind === "podcast") {
    return openPodcastLabel(source.sharedFrom);
  }
  if (source.kind === "tiktok") {
    return recipeVideo ? "Open the video on TikTok" : "Watch on TikTok";
  }
  return `${recipePage ? "Open the recipe" : "Read the article"} on ${sourceName(source)}`;
};

const SharedOverview = ({ payload }: { payload: Extract<SharePayload, { state: "shared" }> }) => {
  const { note, transcript } = payload.snapshot;
  const video = useMemo(() => timedSource(note.source), [note.source]);
  const webArticle = note.source.kind === "web" && note.article != null ? { source: note.source, article: note.article } : null;
  const recipePage = note.source.kind === "web" && note.recipe != null ? { source: note.source, recipe: note.recipe } : null;
  const recipeNote = note.recipe != null ? { source: note.source, recipe: note.recipe } : null;
  const tabsShown = tabsShownFor(
    recipePage !== null,
    webArticle?.article.chapters.length ?? null,
    note.chapters?.length ?? null,
    recipeNote !== null,
  );
  // Adjusted on the visitor's device, never in the copy.
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
  const analytics = useAnalytics();
  const recipeVoice = useRecipeVoice(track, lines, methodActions, note.recipe?.stepCount ?? 0, notePlayer, analytics.sharedPage);
  const summaryLines = useMemo(
    () => (note.recipe == null ? lines : lines.filter(({ section }) => section === SUMMARY_SECTION)),
    [lines, note.recipe],
  );
  const player = usePlayer();
  const episode = useEpisodeEngine(note.source);
  const tiktok = useTikTokEngine(note.source);
  const wide = useMediaQuery(WIDE_QUERY);
  const { signedIn } = useSharedPageReader();
  // Whose narration plays once a recipe is adjusted: docs/features/recipe-notes.md, "Sharing".
  const narration = payload.snapshot.narration;
  const sharedApi = useMemo(() => sharedNarrationApi(narration), [narration]);
  const accountApi = useNarrationApi();
  const accountVoice = useSettingsQuery().data?.narrationVoice ?? DEFAULT_NARRATION_VOICE;
  useEffect(() => {
    const own = adjusted && signedIn;
    player.setVoice(own ? accountVoice : (narration?.voice ?? DEFAULT_NARRATION_VOICE));
    if (adjusted) {
      player.setApi(own ? accountApi : null);
    } else {
      player.setApi(sharedApi);
    }
  }, [player, adjusted, signedIn, sharedApi, accountApi, accountVoice, narration]);
  const navigate = useNavigate();
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
  const saveActionNow = (): SaveAction => {
    if (!signedIn) {
      return { label: "Save to my overviews", onChoose: createAccount };
    }
    if (held.data != null) {
      return {
        label: "Open in my overviews",
        onChoose: () => {
          analytics.sharedPage.actions.openChosen();
          void navigate(Routes.overview(note.id));
        },
      };
    }
    return {
      label: saving ? "Saving…" : "Save to my overviews",
      onChoose: () => {
        analytics.sharedPage.actions.saveChosen();
        void saveIntoAccount();
      },
    };
  };
  const saveAction = saveActionNow();
  // Timers stay on this page, so going into the app warns: docs/features/recipe-notes.md, "Outside the mode".
  const willStop = useTimersWillStop();
  const stopping = useRef({ count: 0, going: false });
  stopping.current.count = willStop.count;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !stopping.current.going && stopping.current.count > 0 && currentLocation.pathname !== nextLocation.pathname,
  );
  const { ask } = willStop;
  useEffect(() => {
    if (blocker.state !== "blocked") {
      return;
    }
    ask(
      {
        sentence: "Going on opens The Overview, and timers on this shared page don’t come with you.",
        stay: "Stay on this page",
        go: stopping.current.count === 1 ? "Go on and stop the timer" : "Go on and stop the timers",
      },
      "leftPage",
      () => {
        stopping.current.going = true;
        blocker.proceed();
      },
      () => blocker.reset(),
    );
    // A blocked navigation asks once; the blocker itself changes on every render.
  }, [blocker.state]);
  const chooseSave = () =>
    saveAction.label === "Open in my overviews"
      ? saveAction.onChoose()
      : willStop.ask(
          {
            sentence: "Saving opens The Overview, and timers on this shared page don’t come with you.",
            stay: "Stay on this page",
            go: willStop.count === 1 ? "Save and stop the timer" : "Save and stop the timers",
          },
          "leftPage",
          () => {
            stopping.current.going = true;
            saveAction.onChoose();
          },
        );

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
  // Measured, not assumed: the read-along's scroll margin and the tab strip's offset are built from them.
  const mastheadHeight = useMeasuredHeight<HTMLDivElement, HTMLElement>(stickyChromeSizes.masthead);
  const tabsHeight = useMeasuredHeight<HTMLDivElement, HTMLDivElement>(stickyChromeSizes.readerTabs);
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

  const playback = episode?.playback ?? tiktok?.playback ?? null;
  const withEpisode = (page: ReactNode) => (playback === null ? page : <PlaybackProvider value={playback}>{page}</PlaybackProvider>);
  // Design 130q: docked beside the note only where no promo takes that column; above the title otherwise.
  const tiktokSource = note.source.kind === "tiktok" ? note.source : null;
  const tiktokDocked = tiktok !== null && signedIn && wide;
  const tiktokStage =
    tiktok !== null && tiktokSource !== null && !tiktokDocked ? (
      <TikTokPlayer engine={tiktok} source={tiktokSource} place={isPhone ? "head" : "stage"} />
    ) : null;

  return withEpisode(
    <div className={styles.page} ref={publishHeightsOn} data-testid={sharedOverviewPageTestIds.root}>
      <PageScrolledSentinel />
      <SharedPageHeader ref={mastheadHeight.measured} />

      <div className={`${styles.body} ${signedIn ? styles.bodyAlone : ""} ${tiktokDocked ? styles.bodyWithDock : ""}`}>
        <main className={styles.main}>
          <div className={styles.head} ref={head}>
            {tiktokStage}
            <div className={`${styles.lead} ${headImageFull ? styles.leadFull : ""}`}>
              {note.source.kind === "podcast" && <EpisodeArt source={note.source} className={styles.art} />}
              {note.source.kind !== "podcast" && note.source.kind !== "tiktok" && (
                <HeadImage
                  key={note.id}
                  ref={image}
                  source={note.source}
                  full={headImageFull}
                  className={styles.image}
                  onToggle={toggleHeadImage}
                />
              )}
              <div className={styles.chips} ref={chips}>
                {note.source.kind === "tiktok" && (
                  <span className={styles.chip} data-testid={sharedOverviewPageTestIds.kindChip}>
                    TikTok
                  </span>
                )}
                <span className={styles.channel} data-testid={sharedOverviewPageTestIds.channel}>
                  {channelLine(note.source, recipeNote !== null, recipePage !== null)}
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
            {episode !== null && note.source.kind === "podcast" && <EpisodePlayer engine={episode} source={note.source} />}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.surfaceAction}
              disabled={saving || (signedIn && held.isPending)}
              onClick={chooseSave}
              data-testid={sharedOverviewPageTestIds.saveButton}
            >
              {saveAction.label}
              <StrokeIcon name="bookmark" size={16} />
            </button>
            <a
              className={styles.surfaceAction}
              href={sourceUrl(note.source)}
              target="_blank"
              rel="noopener"
              onClick={() => analytics.sharedPage.actions.watchOnYouTubeChosen()}
              data-testid={sharedOverviewPageTestIds.watchButton}
            >
              {sourceLinkLabel(note.source, recipeNote !== null, recipePage !== null)}
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
                        {...noteLineRange(line, lines)}
                        range={range}
                        video={video}
                        active={active}
                        asSheet={isPhone}
                        canReadTranscript={payload.snapshot.transcript !== null}
                        onOpenTranscriptAt={openTranscriptAt}
                        direct={episode !== null || tiktok !== null}
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
                {webArticle !== null && <ArticleResources {...webArticle} onPage={null} compact={isPhone} />}
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
            {tab === "Transcript" && video !== null && transcript === null && (
              <SharedTranscriptPrompt label={saveAction.label} saving={saving} onSave={chooseSave} />
            )}
            {tab === "Transcript" && video !== null && transcript !== null && (
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

        {tiktokDocked && tiktokSource !== null && (
          <aside className={styles.dock} aria-label="The TikTok">
            <TikTokPlayer engine={tiktok!} source={tiktokSource} place="dock" />
          </aside>
        )}
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
          if (action === "tryAgain") {
            notePlayer.play("playerBar");
          }
        }}
        onReRecord={() => undefined}
      />
      <CookingTimerDock />
      {willStop.dialog}
    </div>,
  );
};
