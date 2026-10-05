import { useEffect, useRef } from "react";
import type { PlaylistLookup } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { PlaylistPreview as PlaylistPreviewCounts } from "../../util/playlistPreview.js";
import { formatCount, TOKENS_PER_OVERVIEW, tokensText } from "../../util/tokenEstimate.js";
import styles from "./PlaylistPreview.module.scss";
import { playlistPreviewTestIds } from "./PlaylistPreviewTestIds.js";

export interface PlaylistPreviewProps {
  lookup: PlaylistLookup;
  preview: PlaylistPreviewCounts;
  alreadyFollowing: boolean;
  stacked: boolean;
  busy: boolean;
  onFollow: (backfill: boolean) => void;
  onCancel: () => void;
}

const Figure = ({ value }: { value: number }) => <span className={styles.figure}>{formatCount(value)}</span>;

// Design 27c–27f: title, owner and how it's shared, then the numbers as sentences and the
// token estimate labelled as one, every figure counted in code. Both main actions follow;
// Cancel follows nothing. Focus moves to the actions when it opens.
export function PlaylistPreview({ lookup, preview, alreadyFollowing, stacked, busy, onFollow, onCancel }: PlaylistPreviewProps) {
  const firstAction = useRef<HTMLButtonElement>(null);
  const toMake = preview.toMake.length;

  useEffect(() => firstAction.current?.focus(), []);

  const facts = [
    <>
      <Figure value={preview.total} /> {preview.total === 1 ? "video" : "videos"} in the playlist
    </>,
    preview.inLibrary > 0 &&
      (toMake === 0 && preview.unavailable === 0 ? (
        <>
          All <Figure value={preview.inLibrary} /> are already in your library
        </>
      ) : (
        <>
          <Figure value={preview.inLibrary} /> already in your library, so {preview.inLibrary === 1 ? "it’s" : "they’re"} skipped
        </>
      )),
    preview.unavailable > 0 && (
      <>
        <Figure value={preview.unavailable} /> private or deleted, so {preview.unavailable === 1 ? "it’s" : "they’re"} skipped
      </>
    ),
    toMake > 0 && (
      <>
        <Figure value={toMake} /> to make, oldest first
      </>
    ),
  ].filter(Boolean);

  const backfillLabel = toMake === 1 ? "Make its overview" : `Make overviews for all ${formatCount(toMake)}`;
  const foot = alreadyFollowing
    ? `You already follow ${lookup.title}: videos added to it later are queued each time you open The Overview.`
    : toMake === 0
      ? "Following means videos added to it later are queued each time you open The Overview."
      : `Both follow ${lookup.title}: videos added to it later are queued each time you open The Overview.`;

  return (
    <div className={styles.root} data-testid={playlistPreviewTestIds.root}>
      <div className={styles.head}>
        <p className={styles.kicker}>
          <StrokeIcon name="listVideo" size={15} />
          YouTube playlist
        </p>
        <h3 className={`${styles.title} ${stacked ? styles.titleStacked : ""}`} id="playlist-preview-title" data-testid={playlistPreviewTestIds.title}>
          {lookup.title}
        </h3>
        <p className={styles.owner} data-testid={playlistPreviewTestIds.owner}>
          {[lookup.owner, lookup.privacy === "unlisted" ? "Unlisted" : "Public"].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className={styles.card}>
        <ul className={styles.facts} data-testid={playlistPreviewTestIds.facts}>
          {facts.map((fact, index) => (
            <li key={index}>{fact}</li>
          ))}
        </ul>
        {toMake > 0 && (
          <div className={styles.estimate}>
            <p className={styles.estimateLine} data-testid={playlistPreviewTestIds.estimate}>
              About <span className={styles.estimateFigure}>{tokensText(preview.tokens)}</span> tokens on your own API key
            </p>
            <p className={styles.estimateBasis} data-testid={playlistPreviewTestIds.estimateBasis}>
              Estimate: {formatCount(TOKENS_PER_OVERVIEW)} tokens per overview × {formatCount(toMake)}
            </p>
          </div>
        )}
      </div>

      <p className={styles.foot} data-testid={playlistPreviewTestIds.foot}>
        {foot}
      </p>

      <div
        className={`${styles.actions} ${stacked ? styles.actionsStacked : ""}`}
        role="group"
        aria-label={`Follow ${lookup.title}`}
      >
        {toMake > 0 && (
          <button
            ref={firstAction}
            type="button"
            className={styles.primary}
            onClick={() => onFollow(true)}
            disabled={busy}
            data-testid={playlistPreviewTestIds.backfillButton}
          >
            {backfillLabel}
          </button>
        )}
        {!alreadyFollowing && (
          <button
            ref={toMake > 0 ? undefined : firstAction}
            type="button"
            className={toMake > 0 ? styles.secondary : styles.primary}
            onClick={() => onFollow(false)}
            disabled={busy}
            data-testid={playlistPreviewTestIds.newOnlyButton}
          >
            Only new ones from now on
          </button>
        )}
        {!stacked && <span className={styles.spacer} />}
        <button
          ref={toMake === 0 && alreadyFollowing ? firstAction : undefined}
          type="button"
          className={styles.ghost}
          onClick={onCancel}
          data-testid={playlistPreviewTestIds.cancelButton}
        >
          {alreadyFollowing && toMake === 0 ? "Done" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
