import { useState } from "react";
import type { Novelty } from "@overview/types";
import { NOVELTY_LABEL } from "../../../overviews/noveltyLabel.js";
import type { OverviewWithState } from "../../../overviews/types/OverviewWithState.js";
import { OverviewResultCard } from "../../../newOverview/components/OverviewResultCard/OverviewResultCard.js";
import styles from "./LibraryOverviewCard.module.scss";
import { libraryOverviewCardTestIds } from "./LibraryOverviewCardTestIds.js";

export interface LibraryOverviewCardProps {
  overviewWithState: OverviewWithState;
  topicNames: string[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleFavourite: () => void;
  onToggleRead: () => void;
}

// Novel is the only verdict the design marks: it takes the accent rule under the word.
// Everything else recedes to plain type, so a library that is three-quarters recycled
// reads calm (docs/features/overview-redesign.md).
const NOVELTY_CLASS: Record<Novelty, string | undefined> = {
  novel: styles.verdictNovel,
  established: undefined,
  recycled: undefined,
};

const SELLING_LABEL: Record<string, string> = {
  own_paid_product: "Sells own paid product",
  own_free_promotion: "Promotes something of theirs",
  sponsor_or_affiliate: "Sponsored or affiliate",
};

export function LibraryOverviewCard({
  overviewWithState,
  topicNames,
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
  const selling = overview.selling && overview.selling.type !== "none" ? SELLING_LABEL[overview.selling.type] : null;

  return (
    <article
      className={`${styles.root} ${state.read ? styles.isRead : ""}`}
      data-testid={libraryOverviewCardTestIds.root}
    >
      <div className={styles.row}>
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
        <div className={styles.body}>
          <p className={styles.kickerRow}>
            {topicNames.map((name) => (
              <span key={name} className={styles.topicPill}>
                {name}
              </span>
            ))}
            {overview.verdict && (
              <span className={`${styles.verdict} ${NOVELTY_CLASS[overview.verdict.novelty] ?? ""}`}>
                {NOVELTY_LABEL[overview.verdict.novelty]}
              </span>
            )}
            {overview.thin && <span className={styles.verdict}>Thin · no clear claim</span>}
            {overview.verdict?.dubious && <span className={styles.dubious}>⚠ Dubious claim</span>}
            {selling && <span className={styles.selling}>{selling}</span>}
          </p>

          <button
            type="button"
            className={styles.titleButton}
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            data-testid={libraryOverviewCardTestIds.expandToggle}
          >
            <span className={styles.title}>{overview.video.title}</span>
            <span className={styles.meta}>
              <span className={styles.channel}>{overview.video.channel}</span> · {overview.inOneLine}
            </span>
          </button>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.openAction}
              onClick={onToggleExpanded}
              aria-expanded={expanded}
            >
              {expanded ? "Close overview" : "Read overview"}
            </button>
            <button
              type="button"
              className={styles.action}
              onClick={onToggleRead}
              aria-pressed={state.read}
              data-testid={libraryOverviewCardTestIds.readButton}
            >
              {state.read ? "Read" : "Mark read"}
            </button>
            <button
              type="button"
              className={`${styles.action} ${state.favourite ? styles.actionActive : ""}`}
              onClick={onToggleFavourite}
              aria-pressed={state.favourite}
              aria-label={state.favourite ? "Favourited" : "Favourite"}
              title={state.favourite ? "Favourited" : "Favourite"}
              data-testid={libraryOverviewCardTestIds.favouriteButton}
            >
              {state.favourite ? "♥" : "♡"}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className={styles.expanded} data-testid={libraryOverviewCardTestIds.body}>
          <OverviewResultCard overview={overview} />
        </div>
      )}
    </article>
  );
}
