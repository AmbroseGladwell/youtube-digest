import { useCallback, useState, type Ref } from "react";
import { isClipSource, sourceImage, type Source } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useOverviewImageMorph } from "../../../../util/useOverviewImageMorph.js";
import styles from "./HeadImage.module.scss";
import { headImageTestIds } from "./HeadImageTestIds.js";

export interface HeadImageProps {
  source: Source;
  full: boolean;
  className?: string | undefined;
  onToggle: () => void;
  ref?: Ref<HTMLButtonElement> | undefined;
  // Absent on the shared page, which has no library row to carry the image from.
  carriesFrom?: string | undefined;
}

const YOUTUBE_THUMBNAIL = /^(https:\/\/i\.ytimg\.com\/vi(?:_webp)?\/[^/]+\/)[a-z]*default(\.jpg|\.webp)$/;

// YouTube serves a missing size as a 120px grey image, so only a wide load counts as sharper.
const SHARP_MIN_WIDTH = 640;

const sharperImage = (url: string): string | null => {
  const match = YOUTUBE_THUMBNAIL.exec(url);
  return match === null ? null : `${match[1]}maxresdefault${match[2]}`;
};

export const HeadImage = ({ source, full, className, onToggle, ref, carriesFrom }: HeadImageProps) => {
  const [failed, setFailed] = useState(false);
  const [sharpLoaded, setSharpLoaded] = useState(false);
  const imageUrl = sourceImage(source);
  // Design 130g: a TikTok's portrait cover is matted on the stone tint in the 16:9 slot, never cropped; a reel's too.
  const portrait = isClipSource(source);
  const morph = useOverviewImageMorph<HTMLButtonElement>(carriesFrom ?? "", carriesFrom !== undefined);
  // Stable, as a fresh callback ref would re-attach every render; merged with useHeadImageMotion's ref.
  const setButton = useCallback(
    (element: HTMLButtonElement | null) => {
      morph.current = element;
      if (typeof ref === "function") {
        ref(element);
      } else if (ref) {
        ref.current = element;
      }
    },
    [morph, ref],
  );

  if (!imageUrl || failed) {
    return null;
  }

  const sharpUrl = full ? sharperImage(imageUrl!) : null;

  return (
    <button
      type="button"
      ref={setButton}
      className={`${styles.root} ${full ? styles.full : ""} ${portrait ? styles.matte : ""} ${className ?? ""}`}
      aria-pressed={full}
      aria-label={full ? "Show the image small" : "Show the image full width"}
      onClick={onToggle}
      data-testid={headImageTestIds.button}
    >
      <img className={styles.image} src={imageUrl!} alt="" onError={() => setFailed(true)} data-testid={headImageTestIds.image} />
      {sharpUrl !== null && (
        <img
          className={`${styles.image} ${styles.sharp}`}
          src={sharpUrl}
          alt=""
          data-loaded={sharpLoaded}
          onLoad={(event) => setSharpLoaded(event.currentTarget.naturalWidth >= SHARP_MIN_WIDTH)}
          data-testid={headImageTestIds.sharpImage}
        />
      )}
      <span className={styles.veil} aria-hidden="true" data-testid={headImageTestIds.veil}>
        <span className={styles.icon}>
          <StrokeIcon name={full ? "shrink" : "expand"} size={full ? 20 : 16} />
        </span>
      </span>
    </button>
  );
};
