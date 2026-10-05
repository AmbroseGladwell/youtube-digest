import { useEffect, useRef, useState } from "react";
import type { FollowedPlaylist, PlaylistCheck } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { playlistUrl } from "../../../newOverview/util/parseYouTubeUrl.js";
import { checkedAgo, followedPlaylistMeta, unavailableLine } from "../../util/followedPlaylistLines.js";
import styles from "./FollowedPlaylistRow.module.scss";
import { followedPlaylistRowTestIds } from "./FollowedPlaylistRowTestIds.js";

export interface FollowedPlaylistRowProps {
  playlist: FollowedPlaylist;
  check: PlaylistCheck | null;
  overviews: number;
  waiting: number;
  stacked: boolean;
  now: Date;
  onUnfollow: () => void;
}

// Design 27p–27q: the playlist's name opens it on YouTube; one that went private says so in
// words and can still be unfollowed. Unfollowing asks once, inline, with the numbers.
export function FollowedPlaylistRow({ playlist, check, overviews, waiting, stacked, now, onUnfollow }: FollowedPlaylistRowProps) {
  const analytics = useAnalytics();
  const [confirming, setConfirming] = useState(false);
  const [returned, setReturned] = useState(false);
  const confirmTitle = useRef<HTMLParagraphElement>(null);
  const unfollowButton = useRef<HTMLButtonElement>(null);
  const unavailable = unavailableLine(playlist);
  const titleId = `followed-${playlist.id}-unfollow`;

  useEffect(() => {
    if (confirming) confirmTitle.current?.focus();
    else if (returned) unfollowButton.current?.focus();
  }, [confirming, returned]);

  if (confirming) {
    return (
      <li className={styles.confirm} role="group" aria-labelledby={titleId} data-testid={followedPlaylistRowTestIds.confirm}>
        <p className={styles.confirmText} id={titleId} ref={confirmTitle} tabIndex={-1}>
          <strong>Unfollow {playlist.title}?</strong>{" "}
          {waiting > 0 && `${waiting.toLocaleString("en-GB")} ${waiting === 1 ? "video" : "videos"} still queued from it ${waiting === 1 ? "is" : "are"} removed. `}
          {overviews === 0
            ? "Nothing more is queued from it."
            : `The ${overviews.toLocaleString("en-GB")} ${overviews === 1 ? "overview" : "overviews"} already made stay, with their From line.`}
        </p>
        <span className={`${styles.confirmActions} ${stacked ? styles.confirmActionsStacked : ""}`}>
          <button type="button" className={styles.unfollowNow} onClick={onUnfollow} data-testid={followedPlaylistRowTestIds.confirmUnfollowButton}>
            Unfollow
          </button>
          <button
            type="button"
            className={styles.keep}
            onClick={() => {
              analytics.playlists.settings.unfollowKept();
              setReturned(true);
              setConfirming(false);
            }}
            data-testid={followedPlaylistRowTestIds.keepButton}
          >
            Keep following
          </button>
        </span>
      </li>
    );
  }

  return (
    <li className={`${styles.root} ${stacked ? styles.rootStacked : ""}`} data-testid={followedPlaylistRowTestIds.root}>
      <span className={styles.text}>
        {unavailable === null ? (
          <a
            className={styles.title}
            href={playlistUrl(playlist.id)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open the ${playlist.title} playlist on YouTube`}
            data-testid={followedPlaylistRowTestIds.title}
          >
            {playlist.title}
            <StrokeIcon name="openOut" size={13} />
          </a>
        ) : (
          <span className={styles.titlePlain} data-testid={followedPlaylistRowTestIds.title}>
            {playlist.title}
          </span>
        )}
        {unavailable !== null && (
          <span className={styles.unavailable} data-testid={followedPlaylistRowTestIds.unavailable}>
            <StrokeIcon name="alert" size={14} />
            {unavailable}
          </span>
        )}
        <span className={styles.meta} data-testid={followedPlaylistRowTestIds.meta}>
          {followedPlaylistMeta(playlist, check, overviews)}
        </span>
        {unavailable === null && check !== null && (
          <span className={styles.meta} data-testid={followedPlaylistRowTestIds.checked}>
            {checkedAgo(check.checkedAt, now)}
          </span>
        )}
      </span>
      <button
        type="button"
        ref={unfollowButton}
        className={styles.unfollow}
        aria-label={`Unfollow ${playlist.title}`}
        onClick={() => {
          analytics.playlists.settings.unfollowAsked();
          setConfirming(true);
        }}
        data-testid={followedPlaylistRowTestIds.unfollowButton}
      >
        Unfollow
      </button>
    </li>
  );
}
