import type { CSSProperties, KeyboardEvent } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { Routes } from "../../../../app/Routes.js";
import { FavouriteIcon } from "../../../../components/shared/FavouriteIcon/FavouriteIcon.js";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import {
  formatTimestamp,
  noteLengthBadge,
  NOVELTY_LABEL,
  overviewMetaParts,
  overviewTimeSaved,
  sourceName,
  type Source,
  type TextMark,
  type TranscriptMoment,
} from "@overview/domain";
import { KindChip } from "../../../../components/shared/KindChip/KindChip.js";
import { SavedChip } from "../../../timeSaved/components/SavedChip/SavedChip.js";
import { useSavedMoment } from "../../../timeSaved/components/SavedChip/useSavedMoment.js";
import type { OverviewWithState } from "../../../overviews/types/OverviewWithState.js";
import type { LibraryViewState } from "../../util/libraryViewState.js";
import styles from "./LibraryOverviewCard.module.scss";
import { libraryOverviewCardTestIds } from "./LibraryOverviewCardTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { TRANSCRIPT_MOMENT_STATE } from "../../../reader/util/transcriptMomentFromLocation.js";

export interface SaidMoment {
  moment: TranscriptMoment;
  sourceWord: "video" | "episode";
}

export interface LibraryOverviewCardProps {
  overviewWithState: OverviewWithState;
  entering?: boolean;
  topicNames: string[];
  onOpen: (from: "title" | "thumbnail" | "said") => void;
  onToggleFavourite: () => void;
  onToggleRead: () => void;
  playing: boolean;
  onListen: () => void;
  readerState: LibraryViewState;
  addedBy?: { label: string; on: string; projectName: string; onRemove: () => void } | null;
  selection?: { selected: boolean; onToggle: () => void; order: number } | null;
  said?: SaidMoment | null;
}

const SAVED_CHIP_SHOWN_MS = 3_200;

const markedText = (text: string, marks: readonly TextMark[]) => {
  const parts = [];
  let from = 0;
  for (const { start, end } of marks) {
    parts.push(text.slice(from, start), <mark key={start}>{text.slice(start, end)}</mark>);
    from = end;
  }
  parts.push(text.slice(from));
  return parts;
};

const bylineOf = (source: Source): string =>
  source.kind === "web" && source.author !== null ? `${sourceName(source)} · ${source.author}` : sourceName(source);

export const LibraryOverviewCard = ({
  overviewWithState,
  entering = false,
  topicNames,
  onOpen,
  onToggleFavourite,
  onToggleRead,
  playing,
  onListen,
  readerState,
  addedBy = null,
  selection = null,
  said = null,
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

  const box = (className: string | undefined) => (
    <span className={`${styles.box} ${className ?? ""}`} aria-hidden="true">
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
            <span className={styles.meta}>
              <span className={styles.channel}>{bylineOf(overview.source)}</span> · {overview.inOneLine}
            </span>
          </PageLink>

          {said !== null && (
            <PageLink
              className={styles.said}
              to={readerPath}
              state={{ ...readerState, [TRANSCRIPT_MOMENT_STATE]: said.moment.startMs }}
              onClick={() => onOpen("said")}
              data-testid={libraryOverviewCardTestIds.saidLink}
            >
              <span className={styles.saidLabel}>
                <StrokeIcon name="scrollText" size={13} />
                Said in the {said.sourceWord} at {formatTimestamp(said.moment.startMs)}
              </span>
              <span className={styles.saidText}>{markedText(said.moment.text, said.moment.marks)}</span>
            </PageLink>
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
                <SavedChip minutes={saved.minutes} leaving={savedMoment.phase === "leaving"} />
              )}
            </span>

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
                className={`${styles.action} ${styles.readAction} ${state.read ? styles.actionActive : ""}`}
                onClick={toggleRead}
                aria-pressed={state.read}
                data-testid={libraryOverviewCardTestIds.readButton}
              >
                {state.read && <StrokeIcon name="check" />}
                {state.read ? "Read" : "Mark read"}
              </button>
              <button
                type="button"
                className={playing ? styles.actionPlaying : styles.action}
                onClick={onListen}
                aria-pressed={playing}
                data-testid={libraryOverviewCardTestIds.listenButton}
              >
                <StrokeIcon name="headphones" />
                {playing ? "Playing" : "Listen"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
