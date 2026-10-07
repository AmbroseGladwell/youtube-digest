import { useCallback, useRef, useState } from "react";
import { heldOverviewOf, OverviewId, type CaptureEntry, type CaptureTranscriptSource, type Overview } from "@overview/domain";
import { useStores } from "../../stores/StoresContext.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { useSetOverviewCaptureReasonMutation } from "../overviews/mutations/useSetOverviewCaptureReasonMutation.js";
import { captureReasonFromDraft } from "../overviews/util/captureReasonFromDraft.js";
import { useGenerateOverviewMutation } from "./mutations/useGenerateOverviewMutation.js";
import { captureFailureOf } from "./util/captureFailureOf.js";
import { extractYouTubeVideoId } from "./util/parseYouTubeUrl.js";
import type { AlreadyHeld } from "./types/AlreadyHeld.js";
import type { NewOverviewRun } from "./types/NewOverviewRun.js";

export interface StartOverviewRunOptions {
  from: CaptureEntry;
  overviewId?: OverviewId | undefined;
}

export interface NewOverviewRunController {
  run: NewOverviewRun | null;
  // Set instead of a run when the library already holds the video asked for: the dialog
  // offers to open it rather than spending another generation on it.
  held: AlreadyHeld | null;
  dialogOpen: boolean;
  // A link handed over by another paste field, which the dialog opens on: the home page's
  // field passes a playlist link here rather than starting a run (docs/features/playlists.md).
  prefill: string | null;
  open: () => void;
  openWith: (url: string) => void;
  close: () => void;
  start: (url: string, options: StartOverviewRunOptions) => void;
  dismiss: () => void;
  setCaptureReason: (captureReason: string) => void;
  commitCaptureReason: () => void;
}

// Owned by the AppShell, which is the one component that stays mounted across every
// navigation: that is what lets a generation outlive the dialog it was started from
// without a second app-wide context (docs/conventions/frontend-architecture-guide.md 4.1).
export function useNewOverviewRun(): NewOverviewRunController {
  const { apiKeys } = useApiKeys();
  const { overviewStore } = useStores();
  const { mutate } = useGenerateOverviewMutation(apiKeys);
  const { mutate: mutateCaptureReason } = useSetOverviewCaptureReasonMutation();
  const analytics = useAnalytics();
  const [run, setRun] = useState<NewOverviewRun | null>(null);
  const [held, setHeld] = useState<AlreadyHeld | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState<string | null>(null);
  const runIdRef = useRef(0);
  // The draft is read by the pipeline at the moment it writes the record, and by a blur
  // after the record exists, so both need the latest keystroke rather than a render's.
  const draftRef = useRef("");
  const latestRun = useRef<NewOverviewRun | null>(null);
  latestRun.current = run;

  // Whatever has been typed by now, put onto a record that already exists. Returns the
  // record as it will read once the write lands, or the same one when nothing changed.
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

  // A regeneration names the id it writes under and is the reader's deliberate act; any
  // other request for a video the library already holds opens what it holds instead
  // (docs/features/one-overview-per-video.md).
  const alreadyHeld = useCallback(
    async (url: string, options: StartOverviewRunOptions): Promise<AlreadyHeld | null> => {
      if (options.overviewId !== undefined) return null;
      const videoId = extractYouTubeVideoId(url);
      if (videoId === null) return null;
      const found = await heldOverviewOf(overviewStore, videoId).catch(() => null);
      return found === null ? null : { url, overviewId: OverviewId.parse(found.id), readable: found.readable };
    },
    [overviewStore],
  );

  // The callbacks are stable because the status strip's self-dismiss timer depends on
  // them: a fresh identity every render would restart the countdown on every re-render.
  const generate = useCallback(
    (url: string, options: StartOverviewRunOptions, runId: number) => {
      const isCurrent = () => runIdRef.current === runId;
      const { from } = options;
      const startedAt = Date.now();
      let transcriptSource: CaptureTranscriptSource | null = null;
      let tagging = { reused: 0, added: 0 };
      analytics.capture.newOverview.started({ from });

      draftRef.current = "";
      setRun({
        url,
        startedAt: Date.now(),
        finishedAt: null,
        video: null,
        transcriptWords: null,
        overview: null,
        error: null,
        captureReason: "",
      });

      mutate(
        {
          url,
          overviewId: options.overviewId,
          captureReason: () => draftRef.current,
          onProgress: (progress) => {
            transcriptSource = progress.transcriptSource;
            if (isCurrent()) {
              setRun((current) => (current === null ? null : { ...current, ...progress }));
            }
          },
          isCancelled: () => !isCurrent(),
          onTagged: (counted) => {
            tagging = counted;
          },
        },
        {
          onSuccess: (overview) => {
            if (isCurrent()) {
              // A keystroke between the pipeline's read and this callback is the one the
              // record would otherwise miss.
              const saved = commitDraftOnto(overview);
              analytics.capture.newOverview.finished({
                overviewId: saved.id,
                from,
                transcriptSource: transcriptSource ?? "stored",
                durationMs: Date.now() - startedAt,
                reasonGiven: saved.captureReason !== null,
                novelty: saved.verdict?.novelty ?? "none",
                standsOut: saved.verdict?.standsOut != null,
                tagsReused: tagging.reused,
                tagsAdded: tagging.added,
              });
              setRun((current) =>
                current === null ? null : { ...current, overview: saved, finishedAt: Date.now() },
              );
            }
          },
          onError: (error) => {
            if (isCurrent()) {
              analytics.capture.newOverview.failed({
                from,
                failure: captureFailureOf(error, { transcriptResolved: transcriptSource !== null }),
                durationMs: Date.now() - startedAt,
              });
              setRun((current) =>
                current === null ? null : { ...current, error: error.message, finishedAt: Date.now() },
              );
            }
          },
        },
      );
    },
    [mutate, commitDraftOnto, analytics],
  );

  const start = useCallback(
    (url: string, options: StartOverviewRunOptions) => {
      const runId = (runIdRef.current += 1);
      const isCurrent = () => runIdRef.current === runId;
      setHeld(null);
      void alreadyHeld(url, options).then((found) => {
        if (!isCurrent()) return;
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

  const setCaptureReason = useCallback((captureReason: string) => {
    draftRef.current = captureReason;
    setRun((current) => (current === null ? null : { ...current, captureReason }));
  }, []);

  // Before the record exists there is nothing to write to: the pipeline will read the
  // draft when it saves. After, the field saves on blur, with nothing to confirm.
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
    dismiss,
    setCaptureReason,
    commitCaptureReason,
  };
}
