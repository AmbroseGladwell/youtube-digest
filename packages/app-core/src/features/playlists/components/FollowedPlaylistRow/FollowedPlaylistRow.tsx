import { useEffect, useRef, useState } from "react";
import {
  PLAYLIST_ORDERS,
  PLAYLIST_PACES,
  type FollowedPlaylist,
  type PlaylistCheck,
  type PlaylistOrder,
  type PlaylistPace,
} from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { playlistUrl } from "../../../newOverview/util/parseYouTubeUrl.js";
import { checkedAgo, followedPlaylistFacts, followedPlaylistMeta, unavailableLine } from "../../util/followedPlaylistLines.js";
import { ORDER_LABEL, orderChangedLine, orderWaitEffect } from "../../util/orderCopy.js";
import { PACE_LABEL, paceChangedLine, paceWaitEffect } from "../../util/paceCopy.js";
import { ChoicePicker } from "../ChoicePicker/ChoicePicker.js";
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
  onOrderChange: (order: PlaylistOrder) => void;
  onUnfollow: () => void;
}

// Design 27p–27q: the playlist's name opens it on YouTube; one that went private says so in
// words and can still be unfollowed. Unfollowing asks once, inline, with the numbers. Design
// 95x–95z: its pace, the order it is made in and what waits on them, in ink, with both
// beside Unfollow; a change says once, in the row, what it did. One that can't be checked has
// neither to set.
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
  onOrderChange,
  onUnfollow,
}: FollowedPlaylistRowProps) {
  const analytics = useAnalytics();
  const [confirming, setConfirming] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [returned, setReturned] = useState(false);
  const confirmTitle = useRef<HTMLParagraphElement>(null);
  const unfollowButton = useRef<HTMLButtonElement>(null);
  const unavailable = unavailableLine(playlist);
  const waitingLine = `${playlist.title} · ${waiting === 0 ? "nothing waiting" : `${waiting.toLocaleString("en-GB")} waiting`}`;
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
          {waiting > 0 &&
            `${waiting.toLocaleString("en-GB")} ${waiting === 1 ? "video" : "videos"} still queued from it ${waiting === 1 ? "is" : "are"} removed. `}
          {overviews === 0
            ? "Nothing more is queued from it."
            : `The ${overviews.toLocaleString("en-GB")} ${overviews === 1 ? "overview" : "overviews"} already made stay, with their From line.`}
        </p>
        <span className={`${styles.confirmActions} ${stacked ? styles.confirmActionsStacked : ""}`}>
          <button
            type="button"
            className={styles.unfollowNow}
            onClick={onUnfollow}
            data-testid={followedPlaylistRowTestIds.confirmUnfollowButton}
          >
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
          <span className={styles.facts}>
            <span data-testid={followedPlaylistRowTestIds.facts}>{followedPlaylistFacts(playlist, waiting)}</span>
            {check !== null && (
              <span className={styles.checked} data-testid={followedPlaylistRowTestIds.checked}>
                {" "}
                · {checkedAgo(check.checkedAt, now)}
              </span>
            )}
          </span>
        )}
        <span className={styles.said} role="status" aria-live="polite" data-testid={followedPlaylistRowTestIds.said}>
          {said !== null && (
            <>
              <StrokeIcon name="check" size={14} />
              {said}
            </>
          )}
        </span>
      </span>
      <span className={`${styles.controls} ${stacked ? styles.controlsStacked : ""}`}>
        {unavailable === null && (
          <>
            <ChoicePicker
              choice={playlist.pace}
              choices={PLAYLIST_PACES}
              labelOf={(pace) => PACE_LABEL[pace]}
              name="pace"
              title="Pace"
              subject={playlist.title}
              icon="gauge"
              optionDetail={(pace) => paceWaitEffect(pace, waiting)}
              asSheet={asSheet}
              sheetLine={waitingLine}
              sheetFoot="Saved as soon as you choose. Videos you make by hand never count toward it."
              stacked={stacked}
              onChange={(pace) => {
                analytics.playlists.settings.paceChanged({ pace, waiting });
                setSaid(paceChangedLine(pace, waiting, madeToday));
                onPaceChange(pace);
              }}
            />
            <ChoicePicker
              choice={playlist.order}
              choices={PLAYLIST_ORDERS}
              labelOf={(order) => ORDER_LABEL[order]}
              name="order"
              title="Order"
              subject={playlist.title}
              icon="sort"
              optionDetail={(order) => orderWaitEffect(order, waiting)}
              asSheet={asSheet}
              sheetLine={waitingLine}
              sheetFoot="Saved as soon as you choose. The videos already waiting are put in the new order."
              stacked={stacked}
              onChange={(order) => {
                analytics.playlists.settings.orderChanged({ order, waiting });
                setSaid(orderChangedLine(order, waiting));
                onOrderChange(order);
              }}
            />
          </>
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
