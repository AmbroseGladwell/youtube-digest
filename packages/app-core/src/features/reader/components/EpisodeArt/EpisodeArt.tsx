import { useState } from "react";
import { openPodcastLabel, type PodcastSource } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./EpisodeArt.module.scss";
import { episodeArtTestIds } from "./EpisodeArtTestIds.js";

export interface EpisodeArtProps {
  source: PodcastSource;
  className?: string | undefined;
}

export const EpisodeArt = ({ source, className }: EpisodeArtProps) => {
  const [failed, setFailed] = useState(false);
  const label = openPodcastLabel(source.sharedFrom);
  return (
    <a
      className={`${styles.root} ${className ?? ""}`}
      href={source.sharedFrom}
      target="_blank"
      rel="noopener"
      aria-label={`${label}, opens in a new tab`}
      data-testid={episodeArtTestIds.link}
    >
      {source.imageUrl === null || failed ? (
        <span className={styles.nameTile} data-testid={episodeArtTestIds.nameTile}>
          {source.showName}
        </span>
      ) : (
        <img className={styles.image} src={source.imageUrl} alt="" onError={() => setFailed(true)} data-testid={episodeArtTestIds.image} />
      )}
      <span className={styles.veil} aria-hidden="true">
        <StrokeIcon name="openOut" size={14} />
        {label}
      </span>
    </a>
  );
};
