import { formatTimestamp, type TimeRange } from "@overview/domain";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import styles from "./CookingStepVideoSheet.module.scss";
import { cookingStepVideoSheetTestIds } from "./CookingStepVideoSheetTestIds.js";

export interface CookingStepVideoSheetProps {
  open: boolean;
  videoId: string;
  step: number;
  range: TimeRange;
  onClose: () => void;
}

// YouTube's player takes whole seconds, so the stretch is rounded outwards and never cut short.
const embedUrl = (videoId: string, { startMs, endMs }: TimeRange) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?start=${Math.floor(startMs / 1000)}&end=${Math.ceil(endMs / 1000)}&autoplay=1&rel=0`;

export const CookingStepVideoSheet = ({ open, videoId, step, range, onClose }: CookingStepVideoSheetProps) => (
  <BottomSheet open={open} title={`Step ${step} in the video`} onClose={onClose} wide="dialog" testId={cookingStepVideoSheetTestIds.root}>
    <div className={styles.content}>
      <iframe
        className={styles.player}
        src={embedUrl(videoId, range)}
        title={`Step ${step} in the video, from ${formatTimestamp(range.startMs)}`}
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        data-testid={cookingStepVideoSheetTestIds.player}
      />
      <p className={styles.caption}>
        Plays step {step}’s part, {formatTimestamp(range.startMs)} to {formatTimestamp(range.endMs)}, then stops. The voice waits until you
        close it.
      </p>
    </div>
  </BottomSheet>
);
