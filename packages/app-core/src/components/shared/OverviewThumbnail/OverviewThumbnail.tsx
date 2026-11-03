import { useState } from "react";
import { Link } from "react-router";
import { sourceImage, sourceName, type Source, type VideoSource } from "@overview/domain";
import { useShouldAnimateNavigation } from "../../../util/viewTransitions.js";
import styles from "./OverviewThumbnail.module.scss";
import { overviewThumbnailTestIds } from "./OverviewThumbnailTestIds.js";

export interface OverviewThumbnailProps {
  video: VideoSource | Source;
  className?: string | undefined;
  to?: string | undefined;
  state?: unknown;
  onOpen?: (() => void) | undefined;
  // The reader's head (design 147m): the site's name already sits beside where the tile
  // would be, so an article with no image shows nothing rather than a tile repeating it.
  nameTile?: boolean | undefined;
  loading?: "lazy" | "eager" | undefined;
}

// Renders nothing at all when there is no usable image, rather than leaving an empty
// frame behind — CLAUDE.md's degrade-visibly rule. IndexedDB reads aren't re-validated
// against the schema (docs/architecture/v1-architecture-decisions.md's swappable-store
// model reads whatever was saved), so an overview saved before thumbnailUrl existed has
// no such key at all, i.e. undefined, not null. Boolean(...) treats every falsy case
// (undefined, null, "") the same, rather than only the one the current schema can produce.
export function OverviewThumbnail({
  video,
  className,
  to,
  state,
  onOpen,
  nameTile = true,
  loading = "lazy",
}: OverviewThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const animateNavigation = useShouldAnimateNavigation();

  const isArticle = "kind" in video && video.kind === "web";
  const imageUrl = "kind" in video ? sourceImage(video) : video.thumbnailUrl;

  if (nameTile && isArticle && (!Boolean(imageUrl) || failed)) {
    const tile = (
      <span className={styles.nameTile} data-testid={overviewThumbnailTestIds.nameTile}>
        {sourceName(video)}
      </span>
    );
    return to ? (
      <Link
        className={`${styles.thumbnail} ${styles.link} ${styles.tileHost} ${className ?? ""}`}
        to={to}
        state={state}
        viewTransition={animateNavigation}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onOpen}
      >
        {tile}
      </Link>
    ) : (
      <span className={`${styles.thumbnail} ${styles.tileHost} ${className ?? ""}`}>{tile}</span>
    );
  }

  if (!Boolean(imageUrl) || failed) {
    return null;
  }

  const image = (
    <img
      className={to ? styles.linkedImage : `${styles.thumbnail} ${className ?? ""}`}
      src={imageUrl!}
      alt=""
      loading={loading}
      aria-hidden="true"
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
      state={state}
      viewTransition={animateNavigation}
      aria-hidden="true"
      tabIndex={-1}
      onClick={onOpen}
      data-testid={overviewThumbnailTestIds.link}
    >
      {image}
    </Link>
  );
}
