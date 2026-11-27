import { queueHoldOf, queueProblemOf } from "../captureQueue/util/queueProblemOf.js";
import { useNextQuota } from "./useNextQuota.js";
import { usePrefetchVideo } from "./useRunOverviewGeneration.js";
import { useQueryClient } from "@tanstack/react-query";
import { useSurface } from "../../app/SurfaceContext.js";
import { captureKeys } from "../captures/captureKeys.js";
import { captureSurfaceOf } from "../captures/util/captureSurfaceOf.js";
import { madeLaterOf } from "../captures/util/madeLaterOf.js";
import { usePlan } from "../plus/usePlan.js";
import { Routes } from "../../app/Routes.js";
import { useAboutYouAsk, type AboutYouAsk } from "./useAboutYouAsk.js";
import { SavedWithoutOverview } from "./api/SavedWithoutOverview.js";
import { useOverviewUsageQuery } from "./queries/overviewUsageQuery.js";
import { TranscriptionRefusedError } from "../podcasts/api/TranscriptionRefusedError.js";
import { nextUsageMonth } from "../captures/util/nextUsageMonth.js";
import { SavedSourceNeedsReadingError } from "./api/SavedSourceNeedsReadingError.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useIsPanel } from "../../app/LayoutContext.js";
import {
  heldOverviewOf,
  OverviewId,
  articleSourceId,
  parseTikTokLink,
  podcastSource,
  podcastSourceId,
  sourceKey,
  SourceKey,
  type ArticleRead,
  type CaptureEntry,
  type CaptureTranscriptSource,
  type ClientTimingReport,
  type Overview,
  type SavedCapture,
  type VideoSource,
  podcastPlatform,
  wordCount,
} from "@overview/domain";
import { headedParts, offeredLinks } from "@overview/generation";
import { useStores } from "../../stores/StoresContext.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { useSetOverviewCaptureReasonMutation } from "../overviews/mutations/useSetOverviewCaptureReasonMutation.js";
import { captureReasonFromDraft } from "../overviews/util/captureReasonFromDraft.js";
import { ArticleAlreadyHeldError } from "./api/ArticleAlreadyHeldError.js";
import { ArticleReadError } from "./api/ArticleReadError.js";
import { ChosenModelFailedError } from "./api/ChosenModelFailedError.js";
import { useGenerateOverviewMutation } from "./mutations/useGenerateOverviewMutation.js";
import type { GenerationAttempt } from "./api/makeOverviewOnKeys.js";
import { captureFailureOf } from "./util/captureFailureOf.js";
import { madeWithProps } from "./util/madeWithProps.js";
import { noteBudgetProps } from "./util/noteBudgetProps.js";
import { runErrorOf } from "./util/runErrorOf.js";
import { extractYouTubeVideoId, isYouTubeUrl } from "./util/parseYouTubeUrl.js";
import type { AlreadyHeld } from "./types/AlreadyHeld.js";
import type { EpisodeTranscription } from "../podcasts/types/EpisodeTranscription.js";
import type { ArticleRun, NewOverviewRun } from "./types/NewOverviewRun.js";
import type { PodcastRunRequest, SocialRunRequest, TikTokRunRequest } from "./api/generationPipeline.js";

export interface StartOverviewRunOptions {
  from: CaptureEntry;
  overviewId?: OverviewId | undefined;
  captureReason?: string | null | undefined;
  // The soft wall's Save it for now: docs/features/kept-links.md, "Saving at the limit".
  saveInstead?: boolean | undefined;
  // Its overview from what it kept: docs/features/kept-links.md, "Opening one".
  savedCapture?: SavedCapture | undefined;
  // Waits its turn behind what's being made, as Create's links do.
  queued?: boolean | undefined;
}

export interface ArticleRunRequest extends StartOverviewRunOptions {
  url: string;
  title: string;
  site: string;
  // Asked for inside the click, since Chrome refuses it anywhere else.
  access: Promise<boolean>;
  asking: boolean;
  oneTimeAccess: boolean;
  fetched?: boolean;
  read: () => Promise<ArticleRead>;
}

const withVideo =
  (key: number, video: VideoSource | null) =>
  (current: WaitingLink[]): WaitingLink[] =>
    current.map((link) => (link.key === key ? { ...link, video } : link));

export interface WaitingLinkView {
  key: number;
  url: string;
  video: VideoSource | null;
}

interface WaitingLink extends WaitingLinkView {
  go: (runId: number, saveInstead: boolean) => void;
}

export interface NewOverviewRunController {
  run: NewOverviewRun | null;
  // What Create made just now, oldest first, and what waits its turn.
  justNow: NewOverviewRun[];
  waiting: WaitingLinkView[];
  held: AlreadyHeld | null;
  dialogOpen: boolean;
  // The home page's field passes a playlist link here: docs/features/playlists.md, "Pasting a link".
  prefill: string | null;
  open: () => void;
  openWith: (url: string) => void;
  close: () => void;
  start: (url: string, options: StartOverviewRunOptions) => void;
  startArticle: (request: ArticleRunRequest) => void;
  startPodcast: (request: PodcastRunRequest & StartOverviewRunOptions) => void;
  // Asked after Create, or tried again: the last episode or TikTok, transcribed this time.
  transcribeAgain: () => void;
  startTikTok: (request: TikTokRunRequest & StartOverviewRunOptions) => void;
  startSocial: (request: SocialRunRequest & StartOverviewRunOptions) => void;
  startFromSaved: (capture: SavedCapture) => void;
  keepForReset: (request: PodcastRunRequest) => Promise<void>;
  keepForExtension: (url: string, title: string | null) => Promise<void>;
  makeAllSaved: (captures: readonly SavedCapture[]) => void;
  keep: (run: NewOverviewRun) => Promise<void>;
  dismiss: () => void;
  setCaptureReason: (captureReason: string) => void;
  commitCaptureReason: () => void;
  aboutYouAsk: AboutYouAsk;
}

// A new save the reader started, never a regeneration or onboarding's own: docs/features/personalisation.md, "Asked once more".
const mayAskAboutYou = (options: StartOverviewRunOptions): boolean =>
  options.from !== "regenerate" &&
  options.from !== "onboarding" &&
  options.saveInstead !== true &&
  (options.overviewId === undefined || options.savedCapture !== undefined);

type LastTranscribable =
  | { podcast: PodcastRunRequest & StartOverviewRunOptions }
  | { tiktok: TikTokRunRequest & StartOverviewRunOptions }
  | { social: SocialRunRequest & StartOverviewRunOptions };

const noteKindOf = (overview: Overview): "recipe" | "process" | "default" => {
  if (overview.recipe != null) {
    return "recipe";
  }
  return overview.sourceSteps != null ? "process" : "default";
};

// Owned by the AppShell, which stays mounted, so a generation outlives the dialog that started it.
export const useNewOverviewRun = (): NewOverviewRunController => {
  const { apiKeys } = useApiKeys();
  const { overviewStore, captureStore } = useStores();
  const { mutate } = useGenerateOverviewMutation(apiKeys);
  const { mutate: mutateCaptureReason } = useSetOverviewCaptureReasonMutation();
  const analytics = useAnalytics();
  const { plan } = usePlan();
  const reporter = useErrorReporter();
  const surface = useSurface();
  const queryClient = useQueryClient();
  const [run, setRun] = useState<NewOverviewRun | null>(null);
  const [held, setHeld] = useState<AlreadyHeld | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState<string | null>(null);
  const runIdRef = useRef(0);
  const busyRef = useRef(false);
  const waitingKeyRef = useRef(0);
  const [waiting, setWaiting] = useState<WaitingLink[]>([]);
  const waitingRef = useRef<WaitingLink[]>([]);
  const runningUrlRef = useRef<string | null>(null);
  waitingRef.current = waiting;
  const [justNow, setJustNow] = useState<NewOverviewRun[]>([]);
  const prefetchVideo = usePrefetchVideo();
  const nextQuota = useNextQuota();
  const monthSpentRef = useRef(false);
  monthSpentRef.current = nextQuota?.kind === "spent";
  // The pipeline and a later blur both need the latest keystroke, not a render's.
  const draftRef = useRef("");
  const latestRun = useRef<NewOverviewRun | null>(null);
  latestRun.current = run;
  const { beforeWriting, letGo, ...aboutYouAsk } = useAboutYouAsk();
  const { pathname } = useLocation();
  const readingRef = useRef(false);
  readingRef.current = pathname.startsWith(Routes.overview(""));
  const isPanelRef = useRef(false);
  isPanelRef.current = useIsPanel();

  const commitDraftOnto = useCallback(
    (overview: Overview): Overview => {
      const captureReason = captureReasonFromDraft(draftRef.current);
      if (captureReason === overview.captureReason) {
        return overview;
      }
      mutateCaptureReason({ overview, captureReason });
      return { ...overview, captureReason };
    },
    [mutateCaptureReason],
  );

  // docs/features/one-overview-per-video.md, "Prevention: not generating what is already here".
  const alreadyHeld = useCallback(
    async (url: string, options: StartOverviewRunOptions): Promise<AlreadyHeld | null> => {
      if (options.overviewId !== undefined) {
        return null;
      }
      const videoId = extractYouTubeVideoId(url);
      if (videoId === null) {
        return null;
      }
      const found = await heldOverviewOf(overviewStore, videoId).catch(() => null);
      if (found !== null) {
        return { url, overviewId: OverviewId.parse(found.id), readable: found.readable, as: "overview" };
      }
      const capture = await captureStore.captureOfSource(SourceKey.parse(videoId)).catch(() => null);
      return capture === null ? null : { url, overviewId: capture.id, readable: true, as: capture.stage === "saved" ? "saved" : "queued" };
    },
    [overviewStore, captureStore],
  );

  const resetsOnRef = useRef<string | null>(null);
  resetsOnRef.current = useOverviewUsageQuery().data?.resetsOn ?? null;

  // docs/features/kept-links.md, "Only the extension can read".
  const keepForExtension = useCallback(
    async (url: string, title: string | null) => {
      const tiktok = parseTikTokLink(url);
      const at = new Date().toISOString();
      await captureStore.saveCapture({
        id: OverviewId.parse(globalThis.crypto.randomUUID()),
        sourceKey: tiktok?.kind === "video" ? sourceKey({ kind: "tiktok", id: tiktok.videoId })! : await articleSourceId(url),
        url,
        keptAt: at,
        keptFrom: captureSurfaceOf(surface),
        captureReason: draftRef.current.trim() === "" ? null : draftRef.current.trim(),
        title,
        thumbnailUrl: null,
        fromPlaylist: null,
        addedAt: null,
        playlistIndex: null,
        chosenAt: null,
        stage: "kept",
        source: null,
        waitingFor: "extension",
        resumesAt: null,
        queueStatus: "waiting",
        problem: null,
      });
      analytics.keptLinks.queue.linkKept({ plan, captureSurface: captureSurfaceOf(surface), waitingFor: "extension" });
      void queryClient.invalidateQueries({ queryKey: captureKeys.all });
    },
    [captureStore, surface, analytics, plan, queryClient],
  );

  // docs/features/kept-links.md, "Saving at the limit": no transcribing left, so it waits for the month to turn.
  const keepUntilReset = useCallback(
    async (request: PodcastRunRequest, captureReason: string) => {
      const id = await podcastSourceId(request.episode);
      const at = new Date();
      await captureStore.saveCapture({
        id: OverviewId.parse(globalThis.crypto.randomUUID()),
        sourceKey: id,
        url: request.sharedFrom,
        keptAt: at.toISOString(),
        keptFrom: captureSurfaceOf(surface),
        captureReason: captureReason.trim() === "" ? null : captureReason.trim(),
        title: request.episode.title,
        thumbnailUrl: request.episode.imageUrl,
        fromPlaylist: null,
        addedAt: null,
        playlistIndex: null,
        chosenAt: null,
        stage: "kept",
        source: podcastSource(request.episode, id, request.sharedFrom),
        waitingFor: "reset",
        resumesAt: (resetsOnRef.current === null ? nextUsageMonth(at) : new Date(`${resetsOnRef.current}T00:00:00.000Z`)).toISOString(),
        queueStatus: "waiting",
        problem: null,
      });
      analytics.keptLinks.queue.linkKept({ plan, captureSurface: captureSurfaceOf(surface), waitingFor: "reset" });
      void queryClient.invalidateQueries({ queryKey: captureKeys.all });
    },
    [captureStore, surface, analytics, plan, queryClient],
  );

  // Stable callbacks: the status strip's self-dismiss timer would restart on every new identity.
  const generate = useCallback(
    (
      url: string,
      options: StartOverviewRunOptions,
      runId: number,
      articleRequest: ArticleRunRequest | null = null,
      podcastRequest: PodcastRunRequest | null = null,
      tiktokRequest: TikTokRunRequest | null = null,
      socialRequest: SocialRunRequest | null = null,
    ) => {
      const isCurrent = () => runIdRef.current === runId;
      const { from } = options;
      const startedAt = Date.now();
      let transcriptSource: CaptureTranscriptSource | null = null;
      let sourceWords: number | null = null;
      let sourceHeadings = 0;
      let articleLinks: number | undefined;
      let tagging = { reused: 0, added: 0 };
      let personalised = false;
      let projectsFiled: number | undefined;
      let attempt: GenerationAttempt | null = null;
      // A video's duration is the timing's own, so the two agree; an article isn't timed.
      let timing: ClientTimingReport | null = null;
      const askedMs = () => timing?.steps.find(({ step }) => step === "aboutYou")?.ms ?? 0;
      const durationMs = () => (timing === null ? Date.now() - startedAt : timing.totalMs - askedMs());
      let writingAt: number | null = null;
      analytics.capture.newOverview.started({ from });
      const updateArticle = (change: Partial<ArticleRun>) => {
        if (isCurrent()) {
          setRun((current) => (current?.article == null ? current : { ...current, article: { ...current.article, ...change } }));
        }
      };

      draftRef.current = options.captureReason ?? "";
      setRun({
        url,
        startedAt: Date.now(),
        finishedAt: null,
        video: null,
        article:
          articleRequest === null
            ? null
            : {
                title: articleRequest.title,
                site: articleRequest.site,
                words: null,
                asking: articleRequest.asking,
                oneTimeAccess: articleRequest.oneTimeAccess,
                fetched: articleRequest.fetched === true,
                recipe: null,
                regenerating: options.overviewId !== undefined,
                failure: null,
              },
        podcast:
          podcastRequest === null
            ? null
            : {
                show: podcastRequest.episode.showName,
                title: podcastRequest.episode.title,
                platform: podcastPlatform(podcastRequest.sharedFrom),
                durationSeconds: podcastRequest.episode.durationSeconds,
                imageUrl: podcastRequest.episode.imageUrl,
                words: null,
                transcription: podcastRequest.transcribe !== undefined ? { state: "starting" } : null,
              },
        tiktok:
          tiktokRequest === null
            ? null
            : {
                handle: tiktokRequest.video.handle,
                caption: tiktokRequest.video.description,
                durationSeconds: tiktokRequest.video.durationSeconds,
                postedAt: tiktokRequest.video.postedAt,
                coverUrl: tiktokRequest.video.coverUrl,
                words: null,
                transcription: tiktokRequest.words === null ? { state: "starting" } : null,
              },
        social:
          socialRequest === null
            ? null
            : {
                post: socialRequest.post,
                words: null,
                transcription: socialRequest.post.media === "video" && socialRequest.words === null ? { state: "starting" } : null,
              },
        transcriptWords: null,
        overview: null,
        error: null,
        captureReason: draftRef.current,
      });

      if (socialRequest !== null && socialRequest.post.media !== "video") {
        transcriptSource = "article";
        sourceWords = wordCount(socialRequest.post.description);
      }
      const whatToRead = () => {
        if (options.savedCapture !== undefined) {
          return { saved: options.savedCapture };
        }
        if (socialRequest !== null) {
          return { social: socialRequest };
        }
        if (tiktokRequest !== null) {
          return { tiktok: tiktokRequest };
        }
        if (podcastRequest !== null) {
          return { podcast: podcastRequest };
        }
        if (articleRequest === null) {
          return { url };
        }
        return {
          readArticle: async (): Promise<ArticleRead> => {
            const allowed = await articleRequest.access;
            updateArticle({ asking: false });
            return allowed ? articleRequest.read() : { status: "failed", reason: "declined" };
          },
        };
      };
      const what = whatToRead();

      mutate(
        {
          ...what,
          from,
          overviewId: options.overviewId,
          saveInstead: options.saveInstead ? captureSurfaceOf(surface) : undefined,
          captureReason: () => draftRef.current,
          onProgress: (progress) => {
            transcriptSource = progress.transcriptSource;
            sourceWords = progress.transcriptWords;
            if (isCurrent()) {
              setRun((current) => (current === null ? null : { ...current, ...progress }));
            }
          },
          onEpisodeWords: (words) => {
            transcriptSource = "podcast";
            sourceWords = words;
            if (isCurrent()) {
              setRun((current) =>
                current?.podcast == null ? current : { ...current, transcriptWords: words, podcast: { ...current.podcast, words } },
              );
            }
          },
          onTranscription: (progress) => {
            const transcription: EpisodeTranscription =
              progress === "transcribing" ? { state: "transcribing", since: Date.now() } : { state: "starting" };
            if (isCurrent()) {
              setRun((current) => {
                if (current?.podcast != null) {
                  return { ...current, podcast: { ...current.podcast, transcription } };
                }
                if (current?.social != null) {
                  return { ...current, social: { ...current.social, transcription } };
                }
                return current?.tiktok == null ? current : { ...current, tiktok: { ...current.tiktok, transcription } };
              });
            }
          },
          onArticleRead: (article) => {
            transcriptSource = "article";
            sourceWords = article.wordCount;
            sourceHeadings = headedParts(article);
            articleLinks = offeredLinks(article).length;
            if (isCurrent()) {
              setRun((current) =>
                current?.article == null
                  ? current
                  : {
                      ...current,
                      transcriptWords: article.wordCount,
                      article: {
                        ...current.article,
                        title: article.title,
                        site: article.siteName ?? current.article.site,
                        words: article.wordCount,
                        recipe:
                          article.recipe === null
                            ? null
                            : { ingredients: article.recipe.ingredients.length, steps: article.recipe.steps.length },
                      },
                    },
              );
            }
          },
          isCancelled: () => !isCurrent(),
          beforeWriting: mayAskAboutYou(options)
            ? beforeWriting(
                from,
                () => isCurrent() && !readingRef.current,
                (aboutYou) => {
                  if (isCurrent()) {
                    setRun((current) => (current === null ? null : { ...current, aboutYou }));
                    if (aboutYou === "waiting" && !isPanelRef.current) {
                      setDialogOpen(true);
                    }
                  }
                },
              )
            : undefined,
          onTagged: (counted) => {
            tagging = counted;
          },
          onPersonalised: (sent) => {
            personalised = sent;
          },
          onTimed: (timed) => {
            timing = timed;
          },
          onWriting: () => {
            writingAt = Date.now();
          },
          onAttempt: (tried) => {
            attempt = tried;
          },
          onProjectsFiled: (count) => {
            projectsFiled = count;
          },
        },
        {
          onSuccess: (overview) => {
            if (options.savedCapture !== undefined) {
              analytics.keptLinks.saved.overviewMadeLater({
                plan,
                captureSurface: captureSurfaceOf(surface),
                ...madeLaterOf(options.savedCapture.savedAt, new Date()),
              });
            }
            if (isCurrent()) {
              // Catches a keystroke between the pipeline's read and this callback.
              const saved = commitDraftOnto(overview);
              analytics.capture.newOverview.finished({
                overviewId: saved.id,
                from,
                transcriptSource: transcriptSource ?? "stored",
                durationMs: durationMs(),
                ...(writingAt === null ? {} : { writingMs: Date.now() - writingAt }),
                reasonGiven: saved.captureReason !== null,
                novelty: saved.verdict?.novelty ?? "none",
                standsOut: saved.verdict?.standsOut != null,
                tagsReused: tagging.reused,
                tagsAdded: tagging.added,
                howToApplyWritten: saved.howToApply !== null,
                howToApplyItems: saved.howToApply?.items.length ?? 0,
                personalised,
                recipeIngredients: saved.recipe?.ingredientsSaid === undefined ? undefined : saved.recipe.ingredients.length,
                recipeIngredientsSaid: saved.recipe?.ingredientsSaid?.length,
                noteKind: noteKindOf(saved),
                ...noteBudgetProps(saved, sourceWords, sourceHeadings),
                articleLinks,
                articleResources: articleLinks === undefined ? undefined : (saved.article?.resources?.length ?? 0),
                followUpQuestions: saved.followUpQuestions?.length ?? 0,
                readerQuestions: saved.followUpQuestions?.filter((followUp) => followUp.forReader).length ?? 0,
                projectsFiled,
                ...madeWithProps(attempt),
              });
              setRun((current) => (current === null ? null : { ...current, overview: saved, finishedAt: Date.now() }));
            }
          },
          onError: (error) => {
            if (isCurrent() && options.from === "dialog" && !options.saveInstead && queueProblemOf(error) === "monthSpent") {
              generate(url, { ...options, saveInstead: true }, runId, articleRequest, podcastRequest, tiktokRequest, socialRequest);
              return;
            }
            if (error instanceof SavedSourceNeedsReadingError) {
              if (isCurrent()) {
                setRun(null);
                setPrefill(url);
                setDialogOpen(true);
              }
              return;
            }
            if (error instanceof SavedWithoutOverview) {
              analytics.keptLinks.saved.savedWithoutOverview({
                plan,
                captureSurface: captureSurfaceOf(surface),
                transcribed: (podcastRequest?.transcribe ?? tiktokRequest?.transcribe ?? socialRequest?.transcribe) !== undefined,
                fromKeptLink: false,
              });
              void queryClient.invalidateQueries({ queryKey: captureKeys.all });
              if (isCurrent()) {
                setRun((current) => (current === null ? null : { ...current, saved: error.capture, finishedAt: Date.now() }));
              }
              return;
            }
            if (
              podcastRequest !== null &&
              options.saveInstead === true &&
              error instanceof TranscriptionRefusedError &&
              error.refusal === "not-enough"
            ) {
              void keepUntilReset(podcastRequest, options.captureReason ?? "");
              if (isCurrent()) {
                setRun((current) => (current === null ? null : { ...current, keptUntilReset: true, finishedAt: Date.now() }));
              }
              return;
            }
            if (isCurrent() && error instanceof ArticleAlreadyHeldError) {
              const overviewId = OverviewId.parse(error.held.id);
              analytics.capture.newOverview.alreadyHeld({ from, overviewId, held: "overview" });
              setRun(null);
              setHeld({ url, overviewId, readable: error.held.readable, as: "overview" });
              return;
            }
            if (error instanceof ChosenModelFailedError) {
              const { provider, model, reason, status } = error;
              reporter.warn({ name: "chosenModelFailed", provider, model, reason, ...(status === null ? {} : { status }) });
            }
            const problem = queueProblemOf(error);
            const keepable =
              (problem === "serverCap" || problem === "serverBusy") && isYouTubeUrl(url)
                ? { resumesAt: new Date(queueHoldOf(error, problem, new Date()).resumesAt).toISOString() }
                : null;
            if (isCurrent()) {
              analytics.capture.newOverview.failed({
                from,
                failure: captureFailureOf(error, { transcriptResolved: transcriptSource !== null }),
                durationMs: durationMs(),
                ...madeWithProps(attempt),
              });
              setRun((current) =>
                current === null
                  ? null
                  : {
                      ...current,
                      article:
                        current.article !== null && error instanceof ArticleReadError
                          ? { ...current.article, asking: false, failure: error.failure }
                          : current.article,
                      error: runErrorOf(
                        error,
                        articleRequest?.fetched === true ? { url, regenerating: options.overviewId !== undefined } : null,
                        podcastRequest !== null,
                      ),
                      finishedAt: Date.now(),
                      keepable,
                    },
              );
            }
          },
        },
      );
    },
    [mutate, commitDraftOnto, analytics, plan, reporter, surface, queryClient, keepUntilReset, beforeWriting],
  );

  // One at a time from Create; the rest wait their turn: docs/features/kept-links.md, "Several in a row".
  const launch = useCallback(
    (url: string, options: StartOverviewRunOptions, go: (runId: number, saveInstead: boolean) => void) => {
      if (busyRef.current && (runningUrlRef.current === url || waitingRef.current.some((link) => link.url === url))) {
        return;
      }
      setJustNow((current) => current.filter((done) => done.url !== url || done.error === null));
      if ((options.from === "dialog" || options.queued === true) && busyRef.current) {
        const key = (waitingKeyRef.current += 1);
        waitingRef.current = [...waitingRef.current, { key, url, video: null, go }];
        setWaiting(waitingRef.current);
        if (isYouTubeUrl(url)) {
          void prefetchVideo(url).then((video) => setWaiting(withVideo(key, video)));
        }
        return;
      }
      busyRef.current = true;
      runningUrlRef.current = url;
      go((runIdRef.current += 1), false);
    },
    [prefetchVideo],
  );

  useEffect(() => {
    if (run !== null && run.finishedAt === null) {
      return;
    }
    busyRef.current = false;
    runningUrlRef.current = null;
    if (run !== null) {
      setJustNow((current) => (current.some((done) => done.startedAt === run.startedAt) ? current : [...current, run]));
    }
    const [next, ...rest] = waitingRef.current;
    if (next === undefined) {
      return;
    }
    waitingRef.current = rest;
    setWaiting(rest);
    busyRef.current = true;
    runningUrlRef.current = next.url;
    next.go((runIdRef.current += 1), monthSpentRef.current);
  }, [run]);

  const start = useCallback(
    (url: string, options: StartOverviewRunOptions) => {
      setHeld(null);
      void alreadyHeld(url, options).then((found) => {
        if (found !== null) {
          analytics.capture.newOverview.alreadyHeld({ from: options.from, overviewId: found.overviewId, held: found.as });
          setHeld(found);
          return;
        }
        launch(url, options, (runId, saveInstead) => generate(url, { ...options, saveInstead: options.saveInstead || saveInstead }, runId));
      });
    },
    [alreadyHeld, analytics, generate, launch],
  );

  const keep = useCallback(
    async (kept: NewOverviewRun) => {
      if (kept.keepable == null) {
        return;
      }
      const videoId = extractYouTubeVideoId(kept.url);
      if (videoId === null) {
        return;
      }
      const at = new Date().toISOString();
      await captureStore.saveCapture({
        id: OverviewId.parse(globalThis.crypto.randomUUID()),
        sourceKey: SourceKey.parse(videoId),
        url: kept.url,
        keptAt: at,
        keptFrom: captureSurfaceOf(surface),
        captureReason: kept.captureReason.trim() === "" ? null : kept.captureReason.trim(),
        title: kept.video?.title ?? null,
        thumbnailUrl: kept.video?.thumbnailUrl ?? null,
        fromPlaylist: null,
        addedAt: null,
        playlistIndex: null,
        chosenAt: null,
        stage: "kept",
        source: null,
        waitingFor: "server",
        resumesAt: kept.keepable.resumesAt,
        queueStatus: "waiting",
        problem: null,
      });
      analytics.keptLinks.queue.linkKept({ plan, captureSurface: captureSurfaceOf(surface), waitingFor: "server" });
      setJustNow((current) => current.map((done) => (done.startedAt === kept.startedAt ? { ...done, kept: true } : done)));
      void queryClient.invalidateQueries({ queryKey: captureKeys.all });
    },
    [captureStore, surface, queryClient, analytics, plan],
  );

  const startFromSaved = useCallback(
    (capture: SavedCapture) => {
      const runId = (runIdRef.current += 1);
      setHeld(null);
      generate(capture.url, { from: "regenerate", savedCapture: capture, captureReason: capture.captureReason }, runId);
    },
    [generate],
  );

  // Make all on Show › No overview yet: one after another (docs/features/kept-links.md, "Opening one").
  const makeAllSaved = useCallback(
    (captures: readonly SavedCapture[]) => {
      for (const capture of captures) {
        const options = { from: "regenerate" as const, savedCapture: capture, captureReason: capture.captureReason, queued: true };
        launch(capture.url, options, (runId) => generate(capture.url, options, runId));
      }
    },
    [generate, launch],
  );

  const startArticle = useCallback(
    (request: ArticleRunRequest) => {
      setHeld(null);
      launch(request.url, request, (runId, saveInstead) =>
        generate(request.url, { ...request, saveInstead: request.saveInstead || saveInstead }, runId, request),
      );
    },
    [generate, launch],
  );

  const lastTranscribable = useRef<LastTranscribable | null>(null);
  const startPodcast = useCallback(
    (request: PodcastRunRequest & StartOverviewRunOptions) => {
      lastTranscribable.current = { podcast: request };
      setHeld(null);
      launch(request.sharedFrom, request, (runId, saveInstead) =>
        generate(request.sharedFrom, { ...request, saveInstead: request.saveInstead || saveInstead }, runId, null, {
          episode: request.episode,
          sharedFrom: request.sharedFrom,
          transcribe: request.transcribe,
        }),
      );
    },
    [generate, launch],
  );

  const startTikTok = useCallback(
    (request: TikTokRunRequest & StartOverviewRunOptions) => {
      lastTranscribable.current = request.words === null ? { tiktok: request } : null;
      setHeld(null);
      launch(request.video.url, request, (runId, saveInstead) =>
        generate(request.video.url, { ...request, saveInstead: request.saveInstead || saveInstead }, runId, null, null, {
          video: request.video,
          words: request.words,
          transcribe: request.transcribe,
        }),
      );
    },
    [generate, launch],
  );

  const startSocial = useCallback(
    (request: SocialRunRequest & StartOverviewRunOptions) => {
      lastTranscribable.current = request.post.media === "video" && request.words === null ? { social: request } : null;
      setHeld(null);
      launch(request.post.url, request, (runId, saveInstead) =>
        generate(request.post.url, { ...request, saveInstead: request.saveInstead || saveInstead }, runId, null, null, null, {
          post: request.post,
          words: request.words,
          transcribe: request.transcribe,
        }),
      );
    },
    [generate, launch],
  );

  const transcribeAgain = useCallback(() => {
    const last = lastTranscribable.current;
    if (last === null) {
      return;
    }
    if ("tiktok" in last) {
      startTikTok({ ...last.tiktok, transcribe: "retried" });
      return;
    }
    if ("social" in last) {
      startSocial({ ...last.social, transcribe: "retried" });
      return;
    }
    const asked = latestRun.current?.error?.kind === "podcastNeedsTranscribing";
    startPodcast({ ...last.podcast, transcribe: asked ? "asked" : "retried" });
  }, [startPodcast, startTikTok, startSocial]);

  const setCaptureReason = useCallback((captureReason: string) => {
    draftRef.current = captureReason;
    setRun((current) => (current === null ? null : { ...current, captureReason }));
  }, []);

  // Before the record exists the pipeline reads the draft when it saves.
  const commitCaptureReason = useCallback(() => {
    const overview = latestRun.current?.overview ?? null;
    if (overview === null) {
      return;
    }
    const saved = commitDraftOnto(overview);
    if (saved !== overview) {
      setRun((current) => (current === null ? null : { ...current, overview: saved }));
    }
  }, [commitDraftOnto]);

  const open = useCallback(() => {
    setPrefill(null);
    setHeld(null);
    setDialogOpen(true);
  }, []);
  const openWith = useCallback((url: string) => {
    setPrefill(url);
    setHeld(null);
    setDialogOpen(true);
  }, []);
  const close = useCallback(() => {
    setHeld(null);
    setDialogOpen(false);
  }, []);
  const dismiss = useCallback(() => {
    runIdRef.current += 1;
    letGo();
    busyRef.current = false;
    setWaiting([]);
    setJustNow([]);
    setRun(null);
    setHeld(null);
    setDialogOpen(false);
  }, [letGo]);

  return {
    run,
    justNow,
    waiting: waiting.map(({ key, url, video }) => ({ key, url, video })),
    held,
    dialogOpen,
    prefill,
    open,
    openWith,
    close,
    start,
    startArticle,
    startPodcast,
    transcribeAgain,
    startTikTok,
    startSocial,
    startFromSaved,
    keepForReset: (request: PodcastRunRequest) => keepUntilReset(request, draftRef.current),
    keepForExtension,
    makeAllSaved,
    keep,
    dismiss,
    setCaptureReason,
    commitCaptureReason,
    aboutYouAsk,
  };
};
