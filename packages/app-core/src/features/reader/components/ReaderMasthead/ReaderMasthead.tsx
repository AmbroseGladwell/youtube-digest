import type { Ref } from "react";
import { Link } from "react-router";
import { NOVELTY_LABEL, type Overview } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { formatPublishedDate } from "../../../../util/formatPublishedDate.js";
import { useShouldAnimateNavigation } from "../../../../util/viewTransitions.js";
import { FavouriteIcon } from "../../../../components/shared/FavouriteIcon/FavouriteIcon.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useReaderAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import type { OverviewInWebApp } from "../../../sync/useOverviewInWebApp.js";
import { OverviewActionsMenu } from "../OverviewActionsMenu/OverviewActionsMenu.js";
import { TopicLine } from "../TopicLine/TopicLine.js";
import styles from "./ReaderMasthead.module.scss";
import { SavedChip } from "../../../timeSaved/components/SavedChip/SavedChip.js";
import { readerMastheadTestIds } from "./ReaderMastheadTestIds.js";

export interface ReaderMastheadProps {
  overview: Overview;
  metaParts: string[];
  // The "Saved you" chip, while the page holds it after Mark read.
  savedChip: { minutes: number; leaving: boolean } | null;
  read: boolean;
  favourite: boolean;
  playing: boolean;
  editingTopics: boolean;
  // Design 6d and 34v: the side panel's head is the title, the channel, the meta line,
  // Listen and Mark read — no back link, because there is no list behind it to have come from
  // (docs/features/extension-panel.md).
  compact: boolean;
  webApp: OverviewInWebApp;
  listening: boolean;
  onToggleRead: (from: "masthead" | "actionsMenu") => void;
  onToggleFavourite: () => void;
  onTogglePlaying: () => void;
  onListen: () => void;
  onEditingTopicsChange: (editing: boolean) => void;
  onEditReason: () => void;
  onShare: (() => void) | null;
  onDelete: () => void;
  ref?: Ref<HTMLElement> | undefined;
}

// Boolean(...), not !== null: an overview saved before publishedAt existed has no such
// key at all (see OverviewThumbnail, and v1-architecture-decisions.md's swappable-store
// model, which reads back whatever was written).
const savedOn = (savedAt: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(savedAt));

// Design 4a, 5c and 6d: one head, three arrangements. The back link, the actions, the
// menu and the title block are laid out by grid area, so the desktop's top bar, the
// phone's action row under the title and the panel's Listen beside ⋯ are one DOM order
// (docs/features/stone-theme.md, "The single overview").
export function ReaderMasthead({
  overview,
  metaParts,
  savedChip,
  read,
  favourite,
  playing,
  editingTopics,
  compact,
  webApp,
  listening,
  onToggleRead,
  onToggleFavourite,
  onTogglePlaying,
  onListen,
  onEditingTopicsChange,
  onEditReason,
  onShare,
  onDelete,
  ref,
}: ReaderMastheadProps) {
  const animateNavigation = useShouldAnimateNavigation();
  const analytics = useReaderAnalytics();

  return (
    <header
      className={`${styles.root} ${compact ? styles.rootCompact : ""}`}
      ref={ref}
      data-testid={readerMastheadTestIds.root}
    >
      {!compact && (
        <Link
          className={styles.backLink}
          to={Routes.home()}
          viewTransition={animateNavigation}
          onClick={() => analytics.page.backFollowed()}
          data-testid={readerMastheadTestIds.backLink}
        >
          <StrokeIcon name="arrowLeft" size={15} />
          All overviews
        </Link>
      )}

      <div className={styles.actions}>
        {compact ? (
          <>
            <button
              type="button"
              className={`${styles.listen} ${listening ? styles.listenActive : ""}`}
              onClick={onListen}
              aria-pressed={listening}
              data-testid={readerMastheadTestIds.listenButton}
            >
              <StrokeIcon name="headphones" />
              {listening ? "Listening" : "Listen"}
            </button>
            <button
              type="button"
              className={`${styles.read} ${read ? styles.readActive : ""}`}
              onClick={() => onToggleRead("masthead")}
              aria-pressed={read}
              data-testid={readerMastheadTestIds.readButton}
            >
              {read && <StrokeIcon name="check" />}
              {read ? "Read" : "Mark read"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${styles.favourite} ${favourite ? styles.favouriteActive : ""}`}
              onClick={onToggleFavourite}
              aria-pressed={favourite}
              aria-label={favourite ? "Favourited" : "Favourite"}
              data-testid={readerMastheadTestIds.favouriteButton}
            >
              <FavouriteIcon filled={favourite} />
            </button>
            <button
              type="button"
              className={`${styles.listen} ${playing ? styles.listenActive : ""}`}
              onClick={onTogglePlaying}
              aria-pressed={playing}
              data-testid={readerMastheadTestIds.readAloudButton}
            >
              <StrokeIcon name="headphones" />
              {playing ? "Listening" : "Listen"}
            </button>
          </>
        )}
      </div>

      <div className={styles.menu}>
        <OverviewActionsMenu
          topicCount={overview.topicIds.length}
          hasReason={overview.captureReason !== null}
          read={read}
          videoUrl={overview.video.url}
          compact={compact}
          webApp={webApp}
          onShare={onShare}
          onEditTopics={() => onEditingTopicsChange(true)}
          onEditReason={onEditReason}
          onToggleRead={() => onToggleRead("actionsMenu")}
          onDelete={onDelete}
        />
      </div>

      <div className={styles.head}>
        <h2 className={styles.title} data-testid={readerMastheadTestIds.title}>
          {overview.video.title}
        </h2>

        <p className={styles.byline}>
          <span className={styles.channel} data-testid={readerMastheadTestIds.channel}>
            {overview.video.channel}
          </span>
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
        </p>

        <TopicLine
          overview={overview}
          editing={editingTopics}
          onEditingChange={onEditingTopicsChange}
        />

        {/* The panel keeps the judgement and drops the dates: at 400px "published" and
            "saved" are two facts about when, and what the head is for is what the note
            says (docs/features/extension-panel.md). */}
        <p className={styles.metaRow}>
          <span data-testid={readerMastheadTestIds.meta}>{metaParts.join(" · ")}</span>
          {!compact && Boolean(overview.video.publishedAt) && (
            <span data-testid={readerMastheadTestIds.published}>
              {" · published "}
              {formatPublishedDate(overview.video.publishedAt!)}
            </span>
          )}
          {!compact && (
            <span>
              {" · saved "}
              {savedOn(overview.savedAt)}
            </span>
          )}
          {savedChip !== null && (
            <span className={styles.savedChip}>
              <SavedChip minutes={savedChip.minutes} countUp leaving={savedChip.leaving} />
            </span>
          )}
        </p>
      </div>
    </header>
  );
}
