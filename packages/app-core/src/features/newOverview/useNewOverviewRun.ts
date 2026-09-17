import { useCallback, useRef, useState } from "react";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { useGenerateOverviewMutation } from "./mutations/useGenerateOverviewMutation.js";
import type { NewOverviewRun } from "./types/NewOverviewRun.js";

export interface NewOverviewRunController {
  run: NewOverviewRun | null;
  dialogOpen: boolean;
  open: () => void;
  close: () => void;
  start: (url: string) => void;
  dismiss: () => void;
}

// Owned by the AppShell, which is the one component that stays mounted across every
// navigation: that is what lets a generation outlive the dialog it was started from
// without a second app-wide context (docs/conventions/frontend-architecture-guide.md 4.1).
export function useNewOverviewRun(): NewOverviewRunController {
  const { apiKeys } = useApiKeys();
  const { mutate } = useGenerateOverviewMutation(apiKeys);
  const [run, setRun] = useState<NewOverviewRun | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const runIdRef = useRef(0);

  // The callbacks are stable because the status strip's self-dismiss timer depends on
  // them: a fresh identity every render would restart the countdown on every re-render.
  const start = useCallback((url: string) => {
    const runId = (runIdRef.current += 1);
    const isCurrent = () => runIdRef.current === runId;

    setRun({
      url,
      startedAt: Date.now(),
      finishedAt: null,
      video: null,
      transcriptWords: null,
      overview: null,
      error: null,
    });

    mutate(
      {
        url,
        onProgress: (progress) => {
          if (isCurrent()) {
            setRun((current) => (current === null ? null : { ...current, ...progress }));
          }
        },
        isCancelled: () => !isCurrent(),
      },
      {
        onSuccess: (overview) => {
          if (isCurrent()) {
            setRun((current) =>
              current === null ? null : { ...current, overview, finishedAt: Date.now() },
            );
          }
        },
        onError: (error) => {
          if (isCurrent()) {
            setRun((current) =>
              current === null ? null : { ...current, error: error.message, finishedAt: Date.now() },
            );
          }
        },
      },
    );
  }, [mutate]);

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
  };
}
