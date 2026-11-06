import { useRef, useState, type Ref } from "react";
import { NOVELTY_LABEL, type Overview, sourceName, articleReadMinutes, type WebSource } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { formatPublishedDate } from "../../../../util/formatPublishedDate.js";
import { FavouriteIcon } from "../../../../components/shared/FavouriteIcon/FavouriteIcon.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useReaderAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import { useBackTo } from "../../../../app/useBackTo.js";
import { useLentBackLink } from "../../../../app/useLentBackLink.js";
import type { OverviewInWebApp } from "../../../sync/useOverviewInWebApp.js";
import { DUBIOUS_REASONS_PANEL_ID, DubiousReasonsPanel } from "../DubiousReasonsPanel/DubiousReasonsPanel.js";
import { OverviewActionsMenu, type OverviewActionsMenuProps } from "../OverviewActionsMenu/OverviewActionsMenu.js";
import { MadeOnLine } from "../MadeOnLine/MadeOnLine.js";
import { TopicLine } from "../TopicLine/TopicLine.js";
import { HeadImage } from "../HeadImage/HeadImage.js";
import { useHeadImageSize } from "../../../appearance/useHeadImageSize.js";
import { useHeadImageMotion } from "./useHeadImageMotion.js";
import { PlaylistFromLine } from "../../../playlists/components/PlaylistFromLine/PlaylistFromLine.js";
import styles from "./ReaderMasthead.module.scss";
import { SavedChip } from "../../../timeSaved/components/SavedChip/SavedChip.js";
import { readerMastheadTestIds } from "./ReaderMastheadTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

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
  regenerate: OverviewActionsMenuProps["regenerate"];
  recipeActions: OverviewActionsMenuProps["recipe"];
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
// Design 77o: each part drops out when the page didn't give it.
// A recipe's read time sits on its link to the page instead (design 144a).
const articleByline = (source: WebSource, saved: string, recipe: boolean): string =>
  [
    ...(source.author === null ? [] : [`By ${source.author}`]),
    ...(source.publishedAt === null ? [] : [`Published ${formatPublishedDate(source.publishedAt)}`]),
    ...(recipe ? [] : [`${articleReadMinutes(source.wordCount)} min read`]),
    `Saved ${saved}`,
  ].join(" · ");

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
  regenerate,
  recipeActions,
  onDelete,
  ref,
}: ReaderMastheadProps) {
  const analytics = useReaderAnalytics();
  const backToLibrary = useBackTo(Routes.home());
  const headBackLink = useLentBackLink({
    to: Routes.home(),
    label: "All overviews",
    lent: !compact,
    follow: (event) => {
      analytics.page.backFollowed({ from: "bar" });
      backToLibrary(event);
    },
  });
  const dubiousFlag = useRef<HTMLButtonElement | null>(null);
  const [explainingDubious, setExplainingDubious] = useState(false);
  const dubiousClaimCount = overview.verdict?.dubiousClaims?.length ?? 0;
  const dubiousLabel = dubiousClaimCount > 1 ? `${dubiousClaimCount} dubious claims` : "Dubious claim";

  const isArticle = overview.source.kind === "web";

  const headImage = useHeadImageSize();
  const full = headImage.size === "full";
  const header = useRef<HTMLElement | null>(null);
  const image = useRef<HTMLButtonElement | null>(null);
  const title = useRef<HTMLHeadingElement | null>(null);
  const captureBeforeResize = useHeadImageMotion(full, {
    header,
    image,
    title,
    who: () => [...(header.current?.querySelectorAll(`.${styles.sourceLine}, .${styles.byline}`) ?? [])],
  });
  const toggleHeadImage = () => {
    const size = full ? "small" : "full";
    captureBeforeResize();
    analytics.headImage.resized({ size });
    headImage.choose(size);
  };
  const setHeader = (element: HTMLElement | null) => {
    header.current = element;
    if (typeof ref === "function") ref(element);
    else if (ref) ref.current = element;
  };

  return (
    <header
      className={`${styles.root} ${compact ? styles.rootCompact : ""}`}
      ref={setHeader}
      data-testid={readerMastheadTestIds.root}
    >
      {!compact && (
        <PageLink
          ref={headBackLink}
          className={styles.backLink}
          to={Routes.home()}
          onClick={(event) => {
            analytics.page.backFollowed({ from: "head" });
            backToLibrary(event);
          }}
          data-testid={readerMastheadTestIds.backLink}
        >
          <StrokeIcon name="arrowLeft" size={15} />
          All overviews
        </PageLink>
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
          sourceUrl={overview.source.url}
          isArticle={isArticle}
          compact={compact}
          webApp={webApp}
          onShare={onShare}
          regenerate={regenerate}
          recipe={recipeActions}
          onEditTopics={() => onEditingTopicsChange(true)}
          onEditReason={onEditReason}
          onToggleRead={() => onToggleRead("actionsMenu")}
          onDelete={onDelete}
        />
      </div>

      <div className={styles.head}>
        {/* Design 147s: the library row's tile leads the head with only who it's from
            beside it. Without an image, once it fails, or at full width (151b), the lead
            lays out as the head always did, under the image. */}
        <div className={`${styles.lead} ${full ? styles.leadFull : ""}`}>
          {!compact && (
            <HeadImage
              key={overview.id}
              ref={image}
              source={overview.source}
              full={full}
              className={styles.image}
              onToggle={toggleHeadImage}
              carriesFrom={Routes.overview(overview.id)}
            />
          )}
          <div className={styles.who}>
            {isArticle && (
              <p className={styles.sourceLine} data-testid={readerMastheadTestIds.sourceLine}>
                {sourceName(overview.source)} · {overview.recipe === null ? "Article" : "Recipe"}
              </p>
            )}
            <p className={styles.byline}>
              {!isArticle && (
                <span className={styles.channel} data-testid={readerMastheadTestIds.channel}>
                  {sourceName(overview.source)}
                </span>
              )}
              {!isArticle && overview.verdict && (
                <span className={styles.verdict}>{NOVELTY_LABEL[overview.verdict.novelty]}</span>
              )}
              {!isArticle && overview.thin && <span className={styles.verdict}>Thin · no clear claim</span>}
              {overview.verdict?.dubious && (
                <button
                  type="button"
                  ref={dubiousFlag}
                  className={`${styles.dubious} ${explainingDubious ? styles.dubiousOpen : ""}`}
                  onClick={() => {
                    if (!explainingDubious) {
                      analytics.dubiousReasons.opened({ reasonsSaved: dubiousClaimCount });
                    }
                    setExplainingDubious(!explainingDubious);
                  }}
                  aria-expanded={explainingDubious}
                  aria-controls={DUBIOUS_REASONS_PANEL_ID}
                  data-testid={readerMastheadTestIds.dubiousFlag}
                >
                  <StrokeIcon name="alert" size={13} />
                  <span className={styles.dubiousWords}>{dubiousLabel}</span>
                  {dubiousClaimCount > 1 && (
                    <span className={styles.dubiousCount} aria-hidden="true">
                      {dubiousClaimCount}
                    </span>
                  )}
                  <StrokeIcon name={explainingDubious ? "chevronUp" : "chevronDown"} size={14} />
                </button>
              )}
            </p>
          </div>
        </div>

        {explainingDubious && overview.verdict !== null && (
          <div className={styles.dubiousReasons}>
            <DubiousReasonsPanel
              dubiousClaims={overview.verdict.dubiousClaims}
              video={overview.source}
              onClose={() => {
                setExplainingDubious(false);
                dubiousFlag.current?.focus();
              }}
            />
          </div>
        )}

        <h2 className={styles.title} ref={title} data-testid={readerMastheadTestIds.title}>
          {overview.source.title}
        </h2>

        <TopicLine
          overview={overview}
          editing={editingTopics}
          onEditingChange={onEditingTopicsChange}
        />

        {/* The panel keeps the judgement and drops the dates: at 400px "published" and
            "saved" are two facts about when, and what the head is for is what the note
            says (docs/features/extension-panel.md). */}
        <p className={styles.metaRow}>
          <span data-testid={readerMastheadTestIds.meta}>
            {overview.source.kind === "web"
              ? articleByline(overview.source, savedOn(overview.savedAt), overview.recipe !== null)
              : metaParts.join(" · ")}
          </span>
          {!isArticle && !compact && Boolean(overview.source.publishedAt) && (
            <span data-testid={readerMastheadTestIds.published}>
              {" · published "}
              {formatPublishedDate(overview.source.publishedAt!)}
            </span>
          )}
          {!isArticle && !compact && (
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

        <PlaylistFromLine overview={overview} />
        <MadeOnLine overview={overview} />
      </div>
    </header>
  );
}
