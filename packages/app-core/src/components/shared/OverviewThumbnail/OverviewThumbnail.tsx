import { useState } from "react";
import { sourceImage, sourceName, type Source, type VideoSource } from "@overview/domain";
import { useOverviewImageMorph } from "../../../util/useOverviewImageMorph.js";
import styles from "./OverviewThumbnail.module.scss";
import { overviewThumbnailTestIds } from "./OverviewThumbnailTestIds.js";
import { PageLink } from "../PageLink/PageLink.js";

export interface OverviewThumbnailProps {
  video: VideoSource | Source;
  className?: string | undefined;
  to?: string | undefined;
  state?: unknown;
  onOpen?: (() => void) | undefined;
  // Only a library row's thumbnail becomes a note's head; naming more could reuse the name at once.
  carriesIntoHead?: boolean | undefined;
}

const pictureClass = (kind: string, to: string | undefined, className: string | undefined) => {
  if (kind === "podcast") {
    return styles.art;
  }
  return to ? styles.linkedImage : `${styles.thumbnail} ${className ?? ""}`;
};

// Any falsy URL counts as none: a record saved before thumbnailUrl existed has no key, not null.
export const OverviewThumbnail = ({ video, className, to, state, onOpen, carriesIntoHead = false }: OverviewThumbnailProps) => {
  const [failed, setFailed] = useState(false);
  const morph = useOverviewImageMorph<HTMLAnchorElement>(to ?? "", carriesIntoHead);

  const kind = "kind" in video ? video.kind : "youtube";
  const imageUrl = "kind" in video ? sourceImage(video) : video.thumbnailUrl;

  if ("kind" in video && video.kind !== "youtube" && (!imageUrl || failed)) {
    const tile = (
      <span className={styles.nameTile} data-testid={overviewThumbnailTestIds.nameTile}>
        {sourceName(video)}
      </span>
    );
    return to ? (
      <PageLink
        className={`${styles.thumbnail} ${styles.link} ${styles.tileHost} ${className ?? ""}`}
        to={to}
        state={state}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onOpen}
      >
        {tile}
      </PageLink>
    ) : (
      <span className={`${styles.thumbnail} ${styles.tileHost} ${className ?? ""}`}>{tile}</span>
    );
  }

  if (!imageUrl || failed) {
    return null;
  }

  const picture = (
    <img
      className={pictureClass(kind, to, className)}
      src={imageUrl!}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      data-testid={overviewThumbnailTestIds.image}
    />
  );
  // A show's square art is matted in the same 16:9 slot, so rows stay one height.
  const image =
    kind === "podcast" ? (
      <span className={to ? styles.matte : `${styles.thumbnail} ${styles.matte} ${className ?? ""}`}>{picture}</span>
    ) : (
      picture
    );

  if (!to) {
    return image;
  }

  // Out of the tab order and accessibility tree: the title beside it is the same link.
  return (
    <PageLink
      ref={morph}
      className={`${styles.thumbnail} ${styles.link} ${className ?? ""}`}
      to={to}
      state={state}
      aria-hidden="true"
      tabIndex={-1}
      onClick={onOpen}
      data-testid={overviewThumbnailTestIds.link}
    >
      {image}
    </PageLink>
  );
};
