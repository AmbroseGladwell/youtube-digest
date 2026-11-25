import type { CSSProperties, KeyboardEvent } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { Routes } from "../../../../app/Routes.js";
import { FavouriteIcon } from "../../../../components/shared/FavouriteIcon/FavouriteIcon.js";
import { ReadIcon } from "../../../../components/shared/ReadIcon/ReadIcon.js";
import { useMediaQuery } from "../../../../util/useMediaQuery.js";
import { useLongPressTip } from "../../../../util/useLongPressTip.js";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { noteLengthBadge, NOVELTY_LABEL, overviewMetaParts, overviewTimeSaved, sourceName, type Source } from "@overview/domain";
import { KindChip } from "../../../../components/shared/KindChip/KindChip.js";
import { SavedChip } from "../../../timeSaved/components/SavedChip/SavedChip.js";
import { useSavedMoment } from "../../../timeSaved/components/SavedChip/useSavedMoment.js";
import type { OverviewWithState } from "../../../overviews/types/OverviewWithState.js";
import type { LibraryViewState } from "../../util/libraryViewState.js";
import styles from "./LibraryOverviewCard.module.scss";
import { libraryOverviewCardTestIds } from "./LibraryOverviewCardTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { SaidMomentLink, type SaidMoment } from "../SaidMomentLink/SaidMomentLink.js";

export interface LibraryOverviewCardProps {
  overviewWithState: OverviewWithState;
  entering?: boolean;
  topicNames: string[];
  onOpen: (from: "title" | "thumbnail" | "said") => void;
  onImageFailed?: () => void;
  onToggleFavourite: () => void;
  onToggleRead: () => void;
  playing: boolean;
  onListen: () => void;
  readerState: LibraryViewState;
  addedBy?: { label: string; on: string; projectName: string; onRemove: () => void } | null;
  selection?: { selected: boolean; onToggle: () => void; order: number } | null;
  said?: SaidMoment | null;
  siteLink?: SiteLink | null;
}

export interface SiteLink {
  to: string;
  follow: () => void;
}

const SAVED_CHIP_SHOWN_MS = 3_200;
const ICON_ACTIONS_QUERY = "(max-width: 47.9375rem)";

const actionTip = (label: string) => (
  <span className={styles.tip} aria-hidden="true">
    {label}
  </span>
);

const bylineOf = (source: Source): string =>
  source.kind === "web" && source.author !== null ? `${sourceName(source)} · ${source.author}` : sourceName(source);

export const LibraryOverviewCard = ({
  overviewWithState,
  entering = false,
  topicNames,
  onOpen,
  onImageFailed,
  onToggleFavourite,
  onToggleRead,
  playing,
  onListen,
  readerState,
  addedBy = null,
  selection = null,
  said = null,
  siteLink = null,
}: LibraryOverviewCardProps) => {
  const { overview, state } = overviewWithState;
  const readerPath = Routes.overview(overview.id);
  const metaParts = overviewMetaParts(overview);
  const readingParts = metaParts.slice(0, -1);
  const sourceLength = metaParts.at(-1);
  const saved = overviewTimeSaved(overview);
  const savedMoment = useSavedMoment(SAVED_CHIP_SHOWN_MS);
  const toggleRead = () => {
    if (state.read) {
      savedMoment.hide();
    } else if (saved.kind === "counted" && saved.minutes > 0) {
      savedMoment.show();
    }
    onToggleRead();
  };

  const iconActions = useMediaQuery(ICON_ACTIONS_QUERY);
  const favouriteTip = useLongPressTip(iconActions);
  const readTip = useLongPressTip(iconActions);
  const listenTip = useLongPressTip(iconActions);
  const favouriteLabel = state.favourite ? "Favourited" : "Favourite";
  const readLabel = state.read ? "Read" : "Mark read";
  const listenLabel = playing ? "Playing" : "Listen";

  const box = (className: string | undefined) => (
    <span className={`${styles.box} ${className ?? ""}`} aria-hidden="true" data-testid={libraryOverviewCardTestIds.selectBox}>
      <StrokeIcon name="check" size={13} />
    </span>
  );

  return (
    <article
      className={`${styles.root} ${entering ? styles.entering : ""}`}
      data-entering={entering || undefined}
      data-read={state.read || undefined}
      data-selecting={selection !== null || undefined}
      data-selected={selection?.selected || undefined}
      style={{ "--select-order": Math.min(selection?.order ?? 0, 12) } as CSSProperties}
      {...(selection === null
        ? {}
        : {
            role: "checkbox",
            "aria-checked": selection.selected,
            "aria-label": overview.source.title,
            tabIndex: 0,
            onClick: selection.onToggle,
            onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                selection.onToggle();
              }
            },
          })}
      data-testid={libraryOverviewCardTestIds.root}
    >
      {box(styles.thumbnailBox)}
      <div className={styles.row} inert={selection !== null} data-testid={libraryOverviewCardTestIds.row}>
        <OverviewThumbnail
          video={overview.source}
          to={readerPath}
          state={readerState}
          onOpen={() => onOpen("thumbnail")}
          className={styles.thumbnail}
          carriesIntoHead
          badge={noteLengthBadge(overview)}
          onImageFailed={onImageFailed}
        />
        <div className={styles.body}>
          <p className={styles.kickerRow}>
            {box(styles.kickerBox)}
            <span className={styles.kickerGroup}>
              <KindChip overview={overview} />
              {topicNames.map((name) => (
                <span key={name} className={styles.topic}>
                  {name}
                </span>
              ))}
              {overview.verdict && <span className={styles.verdict}>{NOVELTY_LABEL[overview.verdict.novelty]}</span>}
              {overview.recipe === null && overview.thin && <span className={styles.verdict}>Thin · no clear claim</span>}
            </span>
            {overview.verdict?.dubious && (
              <span className={styles.kickerGroup}>
                <span className={styles.dubious}>
                  <StrokeIcon name="alert" size={13} />
                  Dubious claim
                </span>
              </span>
            )}
          </p>

          <PageLink
            className={styles.titleLink}
            to={readerPath}
            state={readerState}
            onClick={() => onOpen("title")}
            data-testid={libraryOverviewCardTestIds.titleLink}
          >
            <span className={styles.title}>{overview.source.title}</span>
            {siteLink === null && (
              <span className={styles.meta}>
                <span className={styles.channel}>{bylineOf(overview.source)}</span> · {overview.inOneLine}
              </span>
            )}
          </PageLink>
          {siteLink !== null && (
            <span className={styles.meta}>
              <PageLink
                className={`${styles.channel} ${styles.siteLink}`}
                to={siteLink.to}
                title={`All from ${sourceName(overview.source)}`}
                onClick={siteLink.follow}
                data-testid={libraryOverviewCardTestIds.siteLink}
              >
                {sourceName(overview.source)}
              </PageLink>
              {overview.source.kind === "web" && overview.source.author !== null && (
                <span className={styles.channel}> · {overview.source.author}</span>
              )}{" "}
              ·{" "}
              <PageLink
                className={styles.oneLine}
                to={readerPath}
                state={readerState}
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => onOpen("title")}
              >
                {overview.inOneLine}
              </PageLink>
            </span>
          )}

          {said !== null && (
            <SaidMomentLink
              said={said}
              to={readerPath}
              readerState={readerState}
              onClick={() => onOpen("said")}
              testId={libraryOverviewCardTestIds.saidLink}
            />
          )}

          {addedBy !== null && (
            <p className={styles.added} data-testid={libraryOverviewCardTestIds.addedBy}>
              <span>
                {addedBy.label} · {addedBy.on}
              </span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                className={styles.remove}
                onClick={addedBy.onRemove}
                aria-label={`Remove from ${addedBy.projectName}`}
                data-testid={libraryOverviewCardTestIds.removeFromProjectButton}
              >
                Remove
              </button>
            </p>
          )}

          <div className={styles.foot}>
            <span className={styles.reading}>
              <p className={styles.timing} data-testid={libraryOverviewCardTestIds.meta}>
                {readingParts.join(" · ")}
                <span className={styles.lengthPart} data-testid={libraryOverviewCardTestIds.metaLength}>
                  {" "}
                  · {sourceLength}
                </span>
              </p>
              {savedMoment.phase !== "hidden" && saved.kind === "counted" && (
                <span className={styles.savedSlot}>
                  <SavedChip minutes={saved.minutes} leaving={savedMoment.phase === "leaving"} />
                </span>
              )}
            </span>

            <div className={styles.actions}>
              <button
                type="button"
                className={`${iconActions ? styles.iconAction : styles.favouriteAction} ${state.favourite ? styles.favouriteActive : ""}`}
                onClick={onToggleFavourite}
                aria-pressed={state.favourite}
                aria-label={favouriteLabel}
                title={iconActions ? undefined : favouriteLabel}
                data-testid={libraryOverviewCardTestIds.favouriteButton}
                {...favouriteTip}
              >
                <FavouriteIcon filled={state.favourite} />
                {iconActions && actionTip(favouriteLabel)}
              </button>
              {iconActions ? (
                <button
                  type="button"
                  className={styles.iconAction}
                  onClick={toggleRead}
                  aria-pressed={state.read}
                  data-testid={libraryOverviewCardTestIds.readButton}
                  {...readTip}
                >
                  <ReadIcon read={state.read} />
                  <span className={styles.visuallyHidden}>{readLabel}</span>
                  {actionTip(readLabel)}
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.action} ${styles.readAction} ${state.read ? styles.actionActive : ""}`}
                  onClick={toggleRead}
                  aria-pressed={state.read}
                  data-testid={libraryOverviewCardTestIds.readButton}
                >
                  {state.read && <StrokeIcon name="check" />}
                  {readLabel}
                </button>
              )}
              {iconActions ? (
                <button
                  type="button"
                  className={`${styles.iconAction} ${styles.listenAction} ${playing ? styles.listening : ""}`}
                  onClick={onListen}
                  aria-pressed={playing}
                  data-testid={libraryOverviewCardTestIds.listenButton}
                  {...listenTip}
                >
                  <span className={styles.orbUnder} aria-hidden="true" />
                  <span className={styles.orb} aria-hidden="true" />
                  <span className={styles.listenGlyph}>
                    <StrokeIcon name="headphones" size={18} />
                  </span>
                  <span className={styles.visuallyHidden}>{listenLabel}</span>
                  {actionTip(listenLabel)}
                </button>
              ) : (
                <button
                  type="button"
                  className={playing ? styles.actionPlaying : styles.action}
                  onClick={onListen}
                  aria-pressed={playing}
                  data-testid={libraryOverviewCardTestIds.listenButton}
                >
                  <StrokeIcon name="headphones" />
                  {listenLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
