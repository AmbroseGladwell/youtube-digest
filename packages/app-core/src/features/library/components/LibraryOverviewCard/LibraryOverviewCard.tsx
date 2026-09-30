import { Link } from "react-router";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useShouldAnimateNavigation } from "../../../../util/viewTransitions.js";
import { Routes } from "../../../../app/Routes.js";
import { FavouriteIcon } from "../../../../components/shared/FavouriteIcon/FavouriteIcon.js";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { NOVELTY_LABEL } from "@overview/domain";
import { overviewMetaParts } from "../../../overviews/util/overviewMetaParts.js";
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

const SELLING_LABEL: Record<string, string> = {
  own_paid_product: "Sells own paid product",
  own_free_promotion: "Promotes something of theirs",
  sponsor_or_affiliate: "Sponsored or affiliate",
};

// Design 10a: a thumbnail-first row on a raised tile. Every verdict is the same stone
// chip, so a library that is three-quarters recycled reads calm; a row already read
// recedes to the muted ink instead (docs/features/stone-theme.md).
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
  const metaParts = overviewMetaParts(overview);

  return (
    <article
      className={`${styles.root} ${entering ? styles.entering : ""}`}
      data-entering={entering || undefined}
      data-read={state.read || undefined}
      data-testid={libraryOverviewCardTestIds.root}
    >
      <div className={styles.row} data-testid={libraryOverviewCardTestIds.row}>
        <OverviewThumbnail video={overview.video} to={readerPath} className={styles.thumbnail} />
        <div className={styles.body}>
          <p className={styles.kickerRow}>
            {topicNames.map((name) => (
              <span key={name} className={styles.topic}>
                {name}
              </span>
            ))}
            {overview.verdict && (
              <span className={styles.verdict}>{NOVELTY_LABEL[overview.verdict.novelty]}</span>
            )}
            {overview.thin && <span className={styles.verdict}>Thin · no clear claim</span>}
            {overview.verdict?.dubious && (
              <span className={styles.dubious}>
                <StrokeIcon name="alert" size={13} />
                Dubious claim
              </span>
            )}
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

          <div className={styles.foot}>
            <p className={styles.timing} data-testid={libraryOverviewCardTestIds.meta}>
              {metaParts.join(" · ")}
            </p>

            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.favouriteAction} ${state.favourite ? styles.favouriteActive : ""}`}
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
                {state.read && <StrokeIcon name="check" />}
                {state.read ? "Read" : "Mark read"}
              </button>
              <Link
                className={styles.action}
                to={readerPath}
                viewTransition={animateNavigation}
                data-testid={libraryOverviewCardTestIds.listenLink}
              >
                <StrokeIcon name="headphones" />
                Listen
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
