import { useState } from "react";
import type { Novelty } from "@overview/types";
import { NOVELTY_LABEL } from "../../../overviews/noveltyLabel.js";
import type { OverviewWithState } from "../../../overviews/types/OverviewWithState.js";
import { OverviewResultCard } from "../../../newOverview/components/OverviewResultCard/OverviewResultCard.js";
import styles from "./LibraryOverviewCard.module.scss";
import { libraryOverviewCardTestIds } from "./LibraryOverviewCardTestIds.js";

export interface LibraryOverviewCardProps {
  overviewWithState: OverviewWithState;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleFavourite: () => void;
  onToggleRead: () => void;
}

const MINI_BADGE_CLASS: Record<Novelty, string | undefined> = {
  novel: styles.miniBadgeNovel,
  established: undefined,
  recycled: styles.miniBadgeRecycled,
};

export function LibraryOverviewCard({
  overviewWithState,
  expanded,
  onToggleExpanded,
  onToggleFavourite,
  onToggleRead,
}: LibraryOverviewCardProps) {
  const { overview, state } = overviewWithState;
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  // IndexedDB reads aren't re-validated against the schema (docs/architecture/v1-architecture-decisions.md's
  // swappable-store model reads whatever was saved) — an overview saved before thumbnailUrl
  // existed has no such key at all, i.e. undefined, not null. Boolean(...) treats every
  // falsy case (undefined, null, "") the same, rather than only catching the one the
  // current schema can produce.
  const showThumbnail = Boolean(overview.video.thumbnailUrl) && !thumbnailFailed;

  return (
    <article
      className={`${styles.root} ${state.read ? styles.isRead : ""}`}
      data-testid={libraryOverviewCardTestIds.root}
    >
      <div className={styles.header}>
        {showThumbnail && (
          <img
            className={styles.thumbnail}
            src={overview.video.thumbnailUrl!}
            alt=""
            loading="lazy"
            onError={() => setThumbnailFailed(true)}
            data-testid={libraryOverviewCardTestIds.thumbnail}
          />
        )}
        <button
          type="button"
          className={styles.expandToggle}
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          data-testid={libraryOverviewCardTestIds.expandToggle}
        >
          {overview.verdict && (
            <div className={styles.badgeRow}>
              <span className={`${styles.miniBadge} ${MINI_BADGE_CLASS[overview.verdict.novelty] ?? ""}`}>
                {NOVELTY_LABEL[overview.verdict.novelty]}
              </span>
              {overview.verdict.dubious && <span className={styles.miniDubious}>⚠ Dubious</span>}
            </div>
          )}
          <p className={styles.title}>{overview.video.title}</p>
          <p className={styles.meta}>
            {overview.video.channel} · {overview.inOneLine}
          </p>
        </button>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.favouriteButton} ${state.favourite ? styles.actionButtonActive : ""}`}
            onClick={onToggleFavourite}
            aria-pressed={state.favourite}
            aria-label={state.favourite ? "Favourited" : "Favourite"}
            title={state.favourite ? "Favourited" : "Favourite"}
            data-testid={libraryOverviewCardTestIds.favouriteButton}
          >
            {state.favourite ? "♥" : "♡"}
          </button>
          <button
            type="button"
            className={`${styles.actionButton} ${state.read ? styles.actionButtonActive : ""}`}
            onClick={onToggleRead}
            aria-pressed={state.read}
            data-testid={libraryOverviewCardTestIds.readButton}
          >
            {state.read ? "Read" : "Mark read"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className={styles.body} data-testid={libraryOverviewCardTestIds.body}>
          <OverviewResultCard overview={overview} />
        </div>
      )}
    </article>
  );
}
