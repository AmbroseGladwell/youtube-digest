import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { NOVELTY_LABEL, type Overview, sourceName, sourceUrl, articleReadMinutes, type WebSource } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { formatPublishedDate } from "../../../../util/formatPublishedDate.js";
import { FavouriteIcon } from "../../../../components/shared/FavouriteIcon/FavouriteIcon.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useReaderAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import { useBackTo } from "../../../../app/useBackTo.js";
import { useLentBackLink } from "../../../../app/useLentBackLink.js";
import { useHomeName } from "../../../../app/useHomeName.js";
import type { OverviewInWebApp } from "../../../sync/useOverviewInWebApp.js";
import { useCitedOverviewPart } from "../../../chats/CitedOverviewPartContext.js";
import { DUBIOUS_REASONS_PANEL_ID, DubiousReasonsPanel } from "../DubiousReasonsPanel/DubiousReasonsPanel.js";
import { OverviewActionsMenu, type OverviewActionsMenuProps } from "../OverviewActionsMenu/OverviewActionsMenu.js";
import { MadeOnLine } from "../MadeOnLine/MadeOnLine.js";
import { TopicLine } from "../TopicLine/TopicLine.js";
import { HeadImage } from "../HeadImage/HeadImage.js";
import { EpisodeArt } from "../EpisodeArt/EpisodeArt.js";
import { timedSource } from "../../util/timedSource.js";
import { KindChip } from "../../../../components/shared/KindChip/KindChip.js";
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
  savedChip: { minutes: number; leaving: boolean } | null;
  read: boolean;
  favourite: boolean;
  playing: boolean;
  editingTopics: boolean;
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
  onChat?: (() => void) | null;
  // Null when signed out, with no library to keep projects in.
  projects: { line: ReactNode; count: number; openPicker: (from: "menu") => void } | null;
  ref?: Ref<HTMLElement> | undefined;
}

const savedOn = (savedAt: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(savedAt));

const articleByline = (source: WebSource, saved: string, recipe: boolean): string =>
  [
    ...(source.author === null ? [] : [`By ${source.author}`]),
    ...(source.publishedAt === null ? [] : [`Published ${formatPublishedDate(source.publishedAt)}`]),
    ...(recipe ? [] : [`${articleReadMinutes(source.wordCount)} min read`]),
    `Saved ${saved}`,
  ].join(" · ");

const sourceLineKind = (hasRecipe: boolean, isArticle: boolean): string => {
  if (!hasRecipe) {
    return "Article";
  }
  return isArticle ? "Recipe" : "Recipe video";
};

export const ReaderMasthead = ({
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
  onChat = null,
  projects,
  ref,
}: ReaderMastheadProps) => {
  const analytics = useReaderAnalytics();
  const backToLibrary = useBackTo(Routes.home());
  const homeName = useHomeName();
  const backLabel = compact ? homeName : "All overviews";
  const headBackLink = useLentBackLink({
    to: Routes.home(),
    label: backLabel,
    follow: (event) => {
      analytics.page.backFollowed({ from: "bar" });
      backToLibrary(event);
    },
  });
  const dubiousFlag = useRef<HTMLButtonElement | null>(null);
  const [explainingDubious, setExplainingDubious] = useState(false);
  const cited = useCitedOverviewPart();
  const citedDubious = cited?.part === "dubiousClaim" ? cited.followed : null;
  useEffect(() => {
    if (citedDubious !== null) {
      setExplainingDubious(true);
    }
  }, [citedDubious]);
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
    if (typeof ref === "function") {
      ref(element);
    } else if (ref) {
      ref.current = element;
    }
  };

  return (
    <header className={styles.root} ref={setHeader} data-testid={readerMastheadTestIds.root}>
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
        {backLabel}
      </PageLink>

      <div className={styles.actions}>
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
          className={`${styles.listen} ${(compact ? listening : playing) ? styles.listenActive : ""}`}
          onClick={compact ? onListen : onTogglePlaying}
          aria-pressed={compact ? listening : playing}
          data-testid={readerMastheadTestIds.readAloudButton}
        >
          <StrokeIcon name="headphones" />
          {(compact ? listening : playing) ? "Listening" : "Listen"}
        </button>
      </div>

      <div className={styles.menu}>
        <OverviewActionsMenu
          topicCount={overview.topicIds.length}
          hasReason={overview.captureReason !== null}
          read={read}
          source={overview.source}
          compact={compact}
          webApp={webApp}
          onShare={onShare}
          regenerate={regenerate}
          recipe={recipeActions}
          onEditTopics={() => onEditingTopicsChange(true)}
          onEditReason={onEditReason}
          onToggleRead={() => onToggleRead("actionsMenu")}
          projects={projects === null ? null : { count: projects.count, onAdd: () => projects.openPicker("menu") }}
          onDelete={onDelete}
          onChat={onChat}
        />
      </div>

      <div className={styles.head}>
        <div className={`${styles.lead} ${full ? styles.leadFull : ""}`}>
          {overview.source.kind === "podcast" ? (
            <EpisodeArt source={overview.source} className={`${styles.art} ${compact ? styles.artCompact : ""}`} />
          ) : (
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
            {(isArticle || overview.recipe !== null) && (
              <p className={styles.sourceLine} data-testid={readerMastheadTestIds.sourceLine}>
                {sourceName(overview.source)} · {sourceLineKind(overview.recipe !== null, isArticle)}
              </p>
            )}
            <p className={styles.byline}>
              {!isArticle && overview.recipe === null && (
                <span className={styles.channel} data-testid={readerMastheadTestIds.channel}>
                  {sourceName(overview.source)}
                  {overview.source.kind === "tiktok" && overview.source.authorName.trim() !== "" && (
                    <small className={styles.handle}> @{overview.source.handle}</small>
                  )}
                </span>
              )}
              {(overview.source.kind === "podcast" || overview.source.kind === "tiktok") && <KindChip overview={overview} />}
              {!isArticle && overview.verdict && <span className={styles.verdict}>{NOVELTY_LABEL[overview.verdict.novelty]}</span>}
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
              video={timedSource(overview.source) ?? { id: overview.source.id, url: sourceUrl(overview.source) }}
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

        <TopicLine overview={overview} editing={editingTopics} onEditingChange={onEditingTopicsChange} />

        <p className={styles.metaRow}>
          <span data-testid={readerMastheadTestIds.meta}>
            {overview.source.kind === "web"
              ? articleByline(overview.source, savedOn(overview.savedAt), overview.recipe !== null)
              : metaParts.join(" · ")}
          </span>
          {!isArticle && Boolean(overview.source.publishedAt) && (
            <span data-testid={readerMastheadTestIds.published}>
              {" · published "}
              {formatPublishedDate(overview.source.publishedAt!)}
            </span>
          )}
          {!isArticle && (
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
        {projects?.line}
        <MadeOnLine overview={overview} />
      </div>
    </header>
  );
};
