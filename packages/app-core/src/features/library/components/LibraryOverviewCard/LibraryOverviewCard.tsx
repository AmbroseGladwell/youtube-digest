import { Link } from "react-router";
import type { Novelty } from "@overview/types";
import { useShouldAnimateNavigation } from "../../../../util/viewTransitions.js";
import { Routes } from "../../../../app/Routes.js";
import { FavouriteIcon } from "../../../../components/shared/FavouriteIcon/FavouriteIcon.js";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { NOVELTY_LABEL } from "../../../overviews/noveltyLabel.js";
import type { OverviewWithState } from "../../../overviews/types/OverviewWithState.js";
import styles from "./LibraryOverviewCard.module.scss";
import { libraryOverviewCardTestIds } from "./LibraryOverviewCardTestIds.js";

export interface LibraryOverviewCardProps {
  overviewWithState: OverviewWithState;
  entering?: boolean;
  topicNames: string[];
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
  entering = false,
  topicNames,
  onToggleFavourite,
  onToggleRead,
}: LibraryOverviewCardProps) {
  const animateNavigation = useShouldAnimateNavigation();
  const { overview, state } = overviewWithState;
  const selling = overview.selling && overview.selling.type !== "none" ? SELLING_LABEL[overview.selling.type] : null;
  const readerPath = Routes.overview(overview.id);

  return (
    <article
      className={`${styles.root} ${entering ? styles.entering : ""}`}
      data-entering={entering || undefined}
      data-testid={libraryOverviewCardTestIds.root}
    >
      <div className={styles.row} data-testid={libraryOverviewCardTestIds.row}>
        <OverviewThumbnail video={overview.video} to={readerPath} className={styles.thumbnail} />
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

          <Link
            className={styles.titleLink}
            to={readerPath}
            viewTransition={animateNavigation}
            data-testid={libraryOverviewCardTestIds.titleLink}
          >
            <span className={styles.title}>{overview.video.title}</span>
            <span className={styles.meta}>
              <span className={styles.channel}>{overview.video.channel}</span> · {overview.inOneLine}
            </span>
          </Link>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.action} ${styles.favouriteAction} ${state.favourite ? styles.actionActive : ""}`}
            onClick={onToggleFavourite}
            aria-pressed={state.favourite}
            aria-label={state.favourite ? "Favourited" : "Favourite"}
            title={state.favourite ? "Favourited" : "Favourite"}
            data-testid={libraryOverviewCardTestIds.favouriteButton}
          >
            <FavouriteIcon filled={state.favourite} />
          </button>
          <button
            type="button"
            className={`${styles.action} ${state.read ? styles.actionActive : ""}`}
            onClick={onToggleRead}
            aria-pressed={state.read}
            data-testid={libraryOverviewCardTestIds.readButton}
          >
            {state.read ? "Read" : "Mark read"}
          </button>
          <Link
            className={styles.primaryAction}
            to={readerPath}
            viewTransition={animateNavigation}
            data-testid={libraryOverviewCardTestIds.listenLink}
          >
            Listen
          </Link>
        </div>
      </div>
    </article>
  );
}
