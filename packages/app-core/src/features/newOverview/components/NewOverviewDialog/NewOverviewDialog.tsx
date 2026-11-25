import { useNewOverviewRunController } from "../../NewOverviewRunContext.js";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Overview, OverviewId } from "@overview/domain";
import { useActiveVideoUrl } from "../../../../app/ActiveVideoContext.js";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import type { AlreadyHeld } from "../../types/AlreadyHeld.js";
import type { NewOverviewRun } from "../../types/NewOverviewRun.js";
import { GenerateOverviewForm, playlistTargetOf } from "../GenerateOverviewForm/GenerateOverviewForm.js";
import {
  PlaylistFollowFlow,
  type PlaylistFlowEntry,
  type PlaylistTarget,
} from "../../../playlists/components/PlaylistFollowFlow/PlaylistFollowFlow.js";
import { usePlaylistApi } from "../../../playlists/usePlaylistApi.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import styles from "./NewOverviewDialog.module.scss";
import { newOverviewDialogTestIds } from "./NewOverviewDialogTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

export interface NewOverviewDialogProps {
  open: boolean;
  prefill: string | null;
  run: NewOverviewRun | null;
  held: AlreadyHeld | null;
  onSubmit: (url: string, options?: { saveInstead: boolean }) => void;
  onOpenHeld: (overviewId: Overview["id"]) => void;
  onClose: () => void;
  onDismiss: () => void;
  onReadOverview: (overview: Overview) => void;
  onCaptureReasonChange: (captureReason: string) => void;
  onCaptureReasonCommit: () => void;
}

export const NewOverviewDialog = ({
  open,
  prefill,
  run,
  held,
  onSubmit,
  onOpenHeld,
  onClose,
  onDismiss,
  onReadOverview,
  onCaptureReasonChange,
  onCaptureReasonCommit,
}: NewOverviewDialogProps) => {
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const activeVideoUrl = useActiveVideoUrl();
  const [url, setUrl] = useState("");
  const [playlist, setPlaylist] = useState<{ target: PlaylistTarget; pastedUrl: string; from: PlaylistFlowEntry } | null>(null);
  const playlistsAvailable = usePlaylistApi() !== null;
  const phone = useIsPhone();

  const [shownOpen, setShownOpen] = useState(false);
  if (shownOpen !== open) {
    setShownOpen(open);
    if (open && run === null) {
      const handedOver = prefill ?? activeVideoUrl ?? "";
      setUrl(handedOver);
      const target = prefill !== null && playlistsAvailable ? playlistTargetOf(prefill) : null;
      setPlaylist(target === null ? null : { target, pastedUrl: prefill!, from: "home" });
    }
  }

  useEffect(() => {
    returnFocusTo.current = open && document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!open) {
      setPlaylist(null);
    }
  }, [open]);

  // Unmounting skips close()'s focus restoration: docs/features/extension-panel.md, "One slot, one way out".
  useEffect(
    () => () => {
      const returnTo = returnFocusTo.current;
      returnFocusTo.current = null;
      if (returnTo !== null && returnTo.isConnected) {
        returnTo.focus();
      }
    },
    [],
  );

  const { waiting } = useNewOverviewRunController();
  const inProgress = (run !== null && run.finishedAt === null) || waiting.length > 0;

  // docs/features/overview-redesign.md, "Generating in the background".
  const analytics = useAnalytics();
  const closeForm = () => requestClose();
  const requestClose = () => {
    if (inProgress) {
      analytics.capture.newOverviewDialog.closed({ run: "running" });
      onClose();
      return;
    }
    if (run !== null && run.overview !== null) {
      analytics.capture.newOverviewDialog.runDismissed({ run: "ready" });
    } else {
      analytics.capture.newOverviewDialog.closed({ run: run === null ? "none" : "failed" });
    }
    onDismiss();
  };

  const handleSubmit = (submittedUrl: string, options?: { saveInstead: boolean }) => {
    setUrl(options?.saveInstead ? submittedUrl : "");
    onSubmit(submittedUrl, options);
  };

  const dialogBody = (): ReactNode => {
    if (playlist !== null) {
      return (
        <PlaylistFollowFlow
          target={playlist.target}
          pastedUrl={playlist.pastedUrl}
          from={playlist.from}
          stacked={phone}
          onJustThisVideo={(videoUrl) => {
            setPlaylist(null);
            handleSubmit(videoUrl);
          }}
          onPasteAnother={() => {
            setPlaylist(null);
            setUrl("");
          }}
          onDone={() => {
            setPlaylist(null);
            onDismiss();
          }}
        />
      );
    }
    // docs/features/one-overview-per-video.md, "Prevention: not generating what is already here".
    return (
      <GenerateOverviewForm
        url={url}
        onUrlChange={setUrl}
        onSubmit={handleSubmit}
        onCancel={closeForm}
        onPlaylist={(target, pastedUrl) => setPlaylist({ target, pastedUrl, from: "dialog" })}
        active={open}
        onReadOverview={(overview) => {
          analytics.capture.newOverviewDialog.readChosen({ overviewId: overview.id, from: "dialog" });
          onReadOverview(overview);
        }}
        onOpen={(id) => onOpenHeld(id as OverviewId)}
        onCaptureReasonChange={onCaptureReasonChange}
        onCaptureReasonCommit={onCaptureReasonCommit}
      />
    );
  };

  return (
    <BottomSheet
      open={open}
      title={playlist === null ? "Make an overview" : "New overview"}
      onClose={requestClose}
      wide="dialog"
      width="33.75rem"
      testId={newOverviewDialogTestIds.root}
    >
      <div className={styles.content} aria-busy={inProgress}>
        {dialogBody()}
      </div>
    </BottomSheet>
  );
};
