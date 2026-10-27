import { useEffect, useRef, useState } from "react";
import { PLAYLIST_PACES, type PlaylistLookup, type PlaylistPace } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { PACE_LABEL, paceConsequence } from "../../util/paceCopy.js";
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
  // The pace both follow actions follow at, preselected to the reader's default. Null hides
  // it: a playlist already followed keeps its own, and a single video needs none.
  pace: PlaylistPace | null;
  defaultPace: PlaylistPace;
  onPaceChange: (pace: PlaylistPace) => void;
  onFollow: (backfill: boolean) => void;
  onCancel: () => void;
}

const Figure = ({ value }: { value: number }) => <span className={styles.figure}>{formatCount(value)}</span>;

// Design 27c–27f: title, owner and how it's shared, then the numbers as sentences and the
// token estimate labelled as one, every figure counted in code. Both main actions follow;
// Cancel follows nothing. Focus moves to the actions when it opens. The pace sits behind one
// line with Change, because the default needs no attention (95t–95v).
export function PlaylistPreview({
  lookup,
  preview,
  alreadyFollowing,
  stacked,
  busy,
  pace,
  defaultPace,
  onPaceChange,
  onFollow,
  onCancel,
}: PlaylistPreviewProps) {
  const firstAction = useRef<HTMLButtonElement>(null);
  const chosenOption = useRef<HTMLInputElement>(null);
  const [choosingPace, setChoosingPace] = useState(false);
  const toMake = preview.toMake.length;

  useEffect(() => firstAction.current?.focus(), []);
  useEffect(() => {
    if (choosingPace) chosenOption.current?.focus();
  }, [choosingPace]);

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
    : pace === null
      ? "Following means videos added to it later are made as they arrive. If it grows, give it a pace in Settings › YouTube playlists."
      : toMake === 0
        ? "Following means videos added to it later are queued each time you open The Overview. Change the pace any time in Settings."
        : `Both follow ${lookup.title}, at this pace. Change it any time in Settings › YouTube playlists.`;

  const paceBlock =
    pace === null ? null : choosingPace ? (
      <div className={styles.paceChoice} role="radiogroup" aria-labelledby="playlist-pace-label" data-testid={playlistPreviewTestIds.paceChoice}>
        <p className={styles.paceChoiceLabel} id="playlist-pace-label">
          Pace for {lookup.title}
        </p>
        {PLAYLIST_PACES.map((option) => (
          <label key={option} className={`${styles.paceOption} ${stacked ? styles.paceOptionStacked : ""}`} data-testid={playlistPreviewTestIds.paceOption(option)}>
            <input
              ref={option === pace ? chosenOption : undefined}
              type="radio"
              name="playlist-pace"
              className={styles.paceRadio}
              value={option}
              checked={option === pace}
              onChange={() => onPaceChange(option)}
            />
            <span className={styles.paceOptionText}>
              <span className={styles.paceOptionName}>
                {PACE_LABEL[option]}
                {option === defaultPace && <span className={styles.paceDefault}> · your default</span>}
              </span>
              <span className={styles.paceOptionResult}>{paceConsequence(option, toMake, toMake > 0)}</span>
            </span>
          </label>
        ))}
      </div>
    ) : (
      <div className={styles.paceLine} data-testid={playlistPreviewTestIds.paceLine}>
        <span className={styles.paceIcon} aria-hidden="true">
          <StrokeIcon name="gauge" size={16} />
        </span>
        <span className={styles.paceText}>
          <span className={styles.paceName} data-testid={playlistPreviewTestIds.paceName}>
            <strong>Pace:</strong> {PACE_LABEL[pace]}
            {pace === defaultPace && <span className={styles.paceDefault}> · your default</span>}
          </span>
          <span className={styles.paceResult} id="playlist-pace-result" data-testid={playlistPreviewTestIds.paceResult}>
            {paceConsequence(pace, toMake, toMake > 0)}
          </span>
        </span>
        <button
          type="button"
          className={`${styles.paceChange} ${stacked ? styles.paceChangeStacked : ""}`}
          aria-label={`Change pace for ${lookup.title}`}
          aria-expanded={false}
          aria-describedby="playlist-pace-result"
          onClick={() => setChoosingPace(true)}
          data-testid={playlistPreviewTestIds.paceChangeButton}
        >
          Change
        </button>
      </div>
    );

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
        {paceBlock !== null && <div className={styles.pace}>{paceBlock}</div>}
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
