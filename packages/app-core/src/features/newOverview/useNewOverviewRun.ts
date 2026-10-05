import { useCallback, useRef, useState } from "react";
import type { CaptureEntry, CaptureTranscriptSource, Overview, OverviewId } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { useSetOverviewCaptureReasonMutation } from "../overviews/mutations/useSetOverviewCaptureReasonMutation.js";
import { captureReasonFromDraft } from "../overviews/util/captureReasonFromDraft.js";
import { useGenerateOverviewMutation } from "./mutations/useGenerateOverviewMutation.js";
import { captureFailureOf } from "./util/captureFailureOf.js";
import type { NewOverviewRun } from "./types/NewOverviewRun.js";

export interface StartOverviewRunOptions {
  from: CaptureEntry;
  overviewId?: OverviewId | undefined;
}

export interface NewOverviewRunController {
  run: NewOverviewRun | null;
  dialogOpen: boolean;
  open: () => void;
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
  const { mutate } = useGenerateOverviewMutation(apiKeys);
  const { mutate: mutateCaptureReason } = useSetOverviewCaptureReasonMutation();
  const analytics = useAnalytics();
  const [run, setRun] = useState<NewOverviewRun | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  // The callbacks are stable because the status strip's self-dismiss timer depends on
  // them: a fresh identity every render would restart the countdown on every re-render.
  const start = useCallback(
    (url: string, options: StartOverviewRunOptions) => {
      const runId = (runIdRef.current += 1);
      const isCurrent = () => runIdRef.current === runId;
      const { from } = options;
      const startedAt = Date.now();
      let transcriptSource: CaptureTranscriptSource | null = null;
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

  const open = useCallback(() => setDialogOpen(true), []);
  const close = useCallback(() => setDialogOpen(false), []);
  const dismiss = useCallback(() => {
    runIdRef.current += 1;
    setRun(null);
    setDialogOpen(false);
  }, []);

  return {
    run,
    dialogOpen,
    open,
    close,
    start,
    dismiss,
    setCaptureReason,
    commitCaptureReason,
  };
}
