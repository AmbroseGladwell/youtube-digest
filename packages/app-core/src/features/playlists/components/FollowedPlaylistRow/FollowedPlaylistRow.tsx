import { useEffect, useRef, useState } from "react";
import type { FollowedPlaylist, PlaylistCheck, PlaylistPace } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { playlistUrl } from "../../../newOverview/util/parseYouTubeUrl.js";
import { checkedAgo, followedPlaylistMeta, unavailableLine } from "../../util/followedPlaylistLines.js";
import { paceChangedLine, paceFacts, paceWaitEffect } from "../../util/paceCopy.js";
import { PacePicker } from "../PacePicker/PacePicker.js";
import styles from "./FollowedPlaylistRow.module.scss";
import { followedPlaylistRowTestIds } from "./FollowedPlaylistRowTestIds.js";

export interface FollowedPlaylistRowProps {
  playlist: FollowedPlaylist;
  check: PlaylistCheck | null;
  overviews: number;
  waiting: number;
  madeToday: number;
  stacked: boolean;
  asSheet: boolean;
  now: Date;
  onPaceChange: (pace: PlaylistPace) => void;
  onUnfollow: () => void;
}

// Design 27p–27q: the playlist's name opens it on YouTube; one that went private says so in
// words and can still be unfollowed. Unfollowing asks once, inline, with the numbers. Design
// 95x–95z: its pace and what waits on it, in ink, with the pace beside Unfollow; a change
// says once, in the row, what it did. One that can't be checked has no pace to set.
export function FollowedPlaylistRow({
  playlist,
  check,
  overviews,
  waiting,
  madeToday,
  stacked,
  asSheet,
  now,
  onPaceChange,
  onUnfollow,
}: FollowedPlaylistRowProps) {
  const analytics = useAnalytics();
  const [confirming, setConfirming] = useState(false);
  const [paceSaid, setPaceSaid] = useState<string | null>(null);
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
        {unavailable === null && (
          <span className={styles.paceFacts}>
            <span data-testid={followedPlaylistRowTestIds.paceFacts}>{paceFacts(playlist.pace, waiting)}</span>
            {check !== null && (
              <span className={styles.checked} data-testid={followedPlaylistRowTestIds.checked}>
                {" "}
                · {checkedAgo(check.checkedAt, now)}
              </span>
            )}
          </span>
        )}
        <span className={styles.said} role="status" aria-live="polite" data-testid={followedPlaylistRowTestIds.paceSaid}>
          {paceSaid !== null && (
            <>
              <StrokeIcon name="check" size={14} />
              {paceSaid}
            </>
          )}
        </span>
      </span>
      <span className={`${styles.controls} ${stacked ? styles.controlsStacked : ""}`}>
        {unavailable === null && (
          <PacePicker
            pace={playlist.pace}
            subject={playlist.title}
            optionDetail={(pace) => paceWaitEffect(pace, waiting)}
            asSheet={asSheet}
            sheetLine={`${playlist.title} · ${waiting === 0 ? "nothing waiting" : `${waiting.toLocaleString("en-GB")} waiting`}`}
            stacked={stacked}
            onChange={(pace) => {
              analytics.playlists.settings.paceChanged({ pace, waiting });
              setPaceSaid(paceChangedLine(pace, waiting, madeToday));
              onPaceChange(pace);
            }}
          />
        )}
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
      </span>
    </li>
  );
}
