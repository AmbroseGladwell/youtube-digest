import { useEffect, useRef } from "react";
import { formatTimestamp, type TimeRange } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./CookingStepVideoSheet.module.scss";
import { cookingStepVideoSheetTestIds } from "./CookingStepVideoSheetTestIds.js";

export interface CookingStepVideoSheetProps {
  open: boolean;
  videoId: string;
  step: number;
  range: TimeRange;
  onClose: () => void;
}

// YouTube's own player starts and stops at whole seconds, so the stretch is the step's
// segments rounded outwards and never cut short.
const embedUrl = (videoId: string, { startMs, endMs }: TimeRange) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?start=${Math.floor(startMs / 1000)}&end=${Math.ceil(endMs / 1000)}&autoplay=1&rel=0`;

// Design 122m: the step's part of the video in a sheet over the step, which stops at the step's
// end. The voice waits; closing the sheet goes back to the step.
export function CookingStepVideoSheet({ open, videoId, step, range, onClose }: CookingStepVideoSheetProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label={`Step ${step} in the video`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      data-testid={cookingStepVideoSheetTestIds.root}
    >
      <div className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.head}>
          <h2 className={styles.title}>Step {step} in the video</h2>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose} data-testid={cookingStepVideoSheetTestIds.close}>
            <StrokeIcon name="close" size={16} />
          </button>
        </div>
        {open && (
          <iframe
            className={styles.player}
            src={embedUrl(videoId, range)}
            title={`Step ${step} in the video, from ${formatTimestamp(range.startMs)}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            data-testid={cookingStepVideoSheetTestIds.player}
          />
        )}
        <p className={styles.caption}>
          Plays step {step}’s part, {formatTimestamp(range.startMs)} to {formatTimestamp(range.endMs)}, then stops. The voice waits until you
          close it.
        </p>
      </div>
    </dialog>
  );
}
