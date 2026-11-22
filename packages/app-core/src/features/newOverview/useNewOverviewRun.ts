import { useCallback, useRef, useState } from "react";
import {
  heldOverviewOf,
  OverviewId,
  type ArticleRead,
  type CaptureEntry,
  type CaptureTranscriptSource,
  type ClientTimingReport,
  type Overview,
  podcastPlatform,
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
import { extractYouTubeVideoId } from "./util/parseYouTubeUrl.js";
import type { AlreadyHeld } from "./types/AlreadyHeld.js";
import type { ArticleRun, NewOverviewRun } from "./types/NewOverviewRun.js";
import type { PodcastRunRequest } from "./api/generationPipeline.js";

export interface StartOverviewRunOptions {
  from: CaptureEntry;
  overviewId?: OverviewId | undefined;
  captureReason?: string | null | undefined;
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

export interface NewOverviewRunController {
  run: NewOverviewRun | null;
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
  transcribePodcast: () => void;
  dismiss: () => void;
  setCaptureReason: (captureReason: string) => void;
  commitCaptureReason: () => void;
}

const noteKindOf = (overview: Overview): "recipe" | "process" | "default" => {
  if (overview.recipe != null) {
    return "recipe";
  }
  return overview.sourceSteps != null ? "process" : "default";
};

// Owned by the AppShell, which stays mounted, so a generation outlives the dialog that started it.
export const useNewOverviewRun = (): NewOverviewRunController => {
  const { apiKeys } = useApiKeys();
  const { overviewStore } = useStores();
  const { mutate } = useGenerateOverviewMutation(apiKeys);
  const { mutate: mutateCaptureReason } = useSetOverviewCaptureReasonMutation();
  const analytics = useAnalytics();
  const reporter = useErrorReporter();
  const [run, setRun] = useState<NewOverviewRun | null>(null);
  const [held, setHeld] = useState<AlreadyHeld | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState<string | null>(null);
  const runIdRef = useRef(0);
  // The pipeline and a later blur both need the latest keystroke, not a render's.
  const draftRef = useRef("");
  const latestRun = useRef<NewOverviewRun | null>(null);
  latestRun.current = run;

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
      return found === null ? null : { url, overviewId: OverviewId.parse(found.id), readable: found.readable };
    },
    [overviewStore],
  );

  // Stable callbacks: the status strip's self-dismiss timer would restart on every new identity.
  const generate = useCallback(
    (
      url: string,
      options: StartOverviewRunOptions,
      runId: number,
      articleRequest: ArticleRunRequest | null = null,
      podcastRequest: PodcastRunRequest | null = null,
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
      const durationMs = () => timing?.totalMs ?? Date.now() - startedAt;
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
        transcriptWords: null,
        overview: null,
        error: null,
        captureReason: draftRef.current,
      });

      const whatToRead = () => {
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
            if (isCurrent()) {
              setRun((current) =>
                current?.podcast == null
                  ? current
                  : {
                      ...current,
                      podcast: {
                        ...current.podcast,
                        transcription: progress === "transcribing" ? { state: "transcribing", since: Date.now() } : { state: "starting" },
                      },
                    },
              );
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
            if (isCurrent() && error instanceof ArticleAlreadyHeldError) {
              const overviewId = OverviewId.parse(error.held.id);
              analytics.capture.newOverview.alreadyHeld({ from, overviewId });
              setRun(null);
              setHeld({ url, overviewId, readable: error.held.readable });
              return;
            }
            if (error instanceof ChosenModelFailedError) {
              const { provider, model, reason, status } = error;
              reporter.warn({ name: "chosenModelFailed", provider, model, reason, ...(status === null ? {} : { status }) });
            }
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
                    },
              );
            }
          },
        },
      );
    },
    [mutate, commitDraftOnto, analytics, reporter],
  );

  const start = useCallback(
    (url: string, options: StartOverviewRunOptions) => {
      const runId = (runIdRef.current += 1);
      const isCurrent = () => runIdRef.current === runId;
      setHeld(null);
      void alreadyHeld(url, options).then((found) => {
        if (!isCurrent()) {
          return;
        }
        if (found !== null) {
          analytics.capture.newOverview.alreadyHeld({ from: options.from, overviewId: found.overviewId });
          setHeld(found);
          return;
        }
        generate(url, options, runId);
      });
    },
    [alreadyHeld, analytics, generate],
  );

  const startArticle = useCallback(
    (request: ArticleRunRequest) => {
      const runId = (runIdRef.current += 1);
      setHeld(null);
      generate(request.url, request, runId, request);
    },
    [generate],
  );

  const lastPodcast = useRef<(PodcastRunRequest & StartOverviewRunOptions) | null>(null);
  const startPodcast = useCallback(
    (request: PodcastRunRequest & StartOverviewRunOptions) => {
      lastPodcast.current = request;
      const runId = (runIdRef.current += 1);
      setHeld(null);
      generate(request.sharedFrom, request, runId, null, {
        episode: request.episode,
        sharedFrom: request.sharedFrom,
        transcribe: request.transcribe,
      });
    },
    [generate],
  );

  const transcribePodcast = useCallback(() => {
    if (lastPodcast.current === null) {
      return;
    }
    const asked = latestRun.current?.error?.kind === "podcastNeedsTranscribing";
    startPodcast({ ...lastPodcast.current, transcribe: asked ? "asked" : "retried" });
  }, [startPodcast]);

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
  const close = useCallback(() => setDialogOpen(false), []);
  const dismiss = useCallback(() => {
    runIdRef.current += 1;
    setRun(null);
    setHeld(null);
    setDialogOpen(false);
  }, []);

  return {
    run,
    held,
    dialogOpen,
    prefill,
    open,
    openWith,
    close,
    start,
    startArticle,
    startPodcast,
    transcribePodcast,
    dismiss,
    setCaptureReason,
    commitCaptureReason,
  };
};
