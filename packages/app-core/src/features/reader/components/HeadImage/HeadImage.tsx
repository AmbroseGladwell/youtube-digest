import { useCallback, useState, type Ref } from "react";
import { sourceImage, type Source } from "@overview/domain";
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
  // Design OV-170: the note's own address, which is both ends of the journey the row's
  // thumbnail makes. The shared page passes nothing, because it has no library behind it
  // (docs/features/page-transitions.md).
  carriesFrom?: string | undefined;
}

const YOUTUBE_THUMBNAIL = /^(https:\/\/i\.ytimg\.com\/vi(?:_webp)?\/[^/]+\/)[a-z]*default(\.jpg|\.webp)$/;

// YouTube's placeholder for a missing size is a 120px grey frame served as an image, so a
// load is only taken as the sharper picture when it is one.
const SHARP_MIN_WIDTH = 640;

const sharperImage = (url: string): string | null => {
  const match = YOUTUBE_THUMBNAIL.exec(url);
  return match === null ? null : `${match[1]}maxresdefault${match[2]}`;
};

// Design 151a–151e and 151p: the image is the control, a button that swaps it between the
// tile and the column's width. Nothing is drawn when there is no image or it fails, so
// there is nothing to press (151q).
export function HeadImage({ source, full, className, onToggle, ref, carriesFrom }: HeadImageProps) {
  const [failed, setFailed] = useState(false);
  const [sharpLoaded, setSharpLoaded] = useState(false);
  const imageUrl = sourceImage(source);
  const morph = useOverviewImageMorph<HTMLButtonElement>(carriesFrom ?? "", carriesFrom !== undefined);
  // The head's own growing motion already holds this element (useHeadImageMotion), so the
  // two refs are merged rather than one replacing the other. Held still across renders: a
  // fresh callback ref each time would have React detach and re-attach it on every one.
  const setButton = useCallback(
    (element: HTMLButtonElement | null) => {
      morph.current = element;
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    },
    [morph, ref],
  );

  if (!Boolean(imageUrl) || failed) {
    return null;
  }

  const sharpUrl = full ? sharperImage(imageUrl!) : null;

  return (
    <button
      type="button"
      ref={setButton}
      className={`${styles.root} ${full ? styles.full : ""} ${className ?? ""}`}
      aria-pressed={full}
      aria-label={full ? "Show the image small" : "Show the image full width"}
      onClick={onToggle}
      data-testid={headImageTestIds.button}
    >
      <img
        className={styles.image}
        src={imageUrl!}
        alt=""
        onError={() => setFailed(true)}
        data-testid={headImageTestIds.image}
      />
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
}
