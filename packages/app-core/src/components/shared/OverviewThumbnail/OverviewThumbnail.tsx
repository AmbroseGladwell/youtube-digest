import { useState } from "react";
import { Link } from "react-router";
import type { VideoSource } from "@overview/domain";
import { useShouldAnimateNavigation } from "../../../util/viewTransitions.js";
import styles from "./OverviewThumbnail.module.scss";
import { overviewThumbnailTestIds } from "./OverviewThumbnailTestIds.js";

export interface OverviewThumbnailProps {
  video: VideoSource;
  className?: string | undefined;
  to?: string | undefined;
}

// Renders nothing at all when there is no usable image, rather than leaving an empty
// frame behind — CLAUDE.md's degrade-visibly rule. IndexedDB reads aren't re-validated
// against the schema (docs/architecture/v1-architecture-decisions.md's swappable-store
// model reads whatever was saved), so an overview saved before thumbnailUrl existed has
// no such key at all, i.e. undefined, not null. Boolean(...) treats every falsy case
// (undefined, null, "") the same, rather than only the one the current schema can produce.
export function OverviewThumbnail({ video, className, to }: OverviewThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const animateNavigation = useShouldAnimateNavigation();

  if (!Boolean(video.thumbnailUrl) || failed) {
    return null;
  }

  const image = (
    <img
      className={to ? styles.linkedImage : `${styles.thumbnail} ${className ?? ""}`}
      src={video.thumbnailUrl!}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      data-testid={overviewThumbnailTestIds.image}
    />
  );

  if (!to) {
    return image;
  }

  // The title beside it already links to the same place with the same words, so this one
  // is taken out of the tab order and the accessibility tree rather than repeated as a
  // second, unlabelled link.
  return (
    <Link
      className={`${styles.thumbnail} ${styles.link} ${className ?? ""}`}
      to={to}
      viewTransition={animateNavigation}
      aria-hidden="true"
      tabIndex={-1}
      data-testid={overviewThumbnailTestIds.link}
    >
      {image}
    </Link>
  );
}
