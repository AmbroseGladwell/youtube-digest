import type { PlaylistId } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { usePlaylistLookupQuery } from "../../queries/playlistLookupQuery.js";
import styles from "./PlaylistLinkChoice.module.scss";
import { playlistLinkChoiceTestIds } from "./PlaylistLinkChoiceTestIds.js";

export interface PlaylistLinkChoiceProps {
  playlistId: PlaylistId;
  disabled: boolean;
  stacked: boolean;
  onVideo: () => void;
  onPlaylist: () => void;
}

// Design 27a: a watch link that also carries a playlist replaces Generate with the two
// things it could mean, so nothing on the screen guesses. "Just this video" carries on as
// before.
export function PlaylistLinkChoice({ playlistId, disabled, stacked, onVideo, onPlaylist }: PlaylistLinkChoiceProps) {
  const analytics = useAnalytics();
  const lookup = usePlaylistLookupQuery(playlistId);
  const playlistDetail =
    lookup.data === undefined
      ? "Follow it, and see what’s in it first"
      : `${lookup.data.title} · ${lookup.data.entries.length.toLocaleString("en-GB")} ${lookup.data.entries.length === 1 ? "video" : "videos"}`;

  return (
    <div className={styles.root} data-testid={playlistLinkChoiceTestIds.root}>
      <p className={styles.question} id="playlist-link-choice">
        This link is a video inside a playlist. Which do you want?
      </p>
      <div className={`${styles.choices} ${stacked ? styles.choicesStacked : ""}`} role="group" aria-labelledby="playlist-link-choice">
        <button
          type="button"
          className={styles.choice}
          disabled={disabled}
          onClick={() => {
            analytics.playlists.link.choiceMade({ choice: "video" });
            onVideo();
          }}
          data-testid={playlistLinkChoiceTestIds.videoButton}
        >
          <span className={styles.icon}>
            <StrokeIcon name="video" size={18} />
          </span>
          <span className={styles.text}>
            <span className={styles.label}>Just this video</span>
            <span className={styles.detail}>One overview, made now</span>
          </span>
          <span className={styles.chevron}>
            <StrokeIcon name="chevronRight" size={18} />
          </span>
        </button>
        <button
          type="button"
          className={styles.choice}
          onClick={() => {
            analytics.playlists.link.choiceMade({ choice: "playlist" });
            onPlaylist();
          }}
          data-testid={playlistLinkChoiceTestIds.playlistButton}
        >
          <span className={styles.icon}>
            <StrokeIcon name="listVideo" size={18} />
          </span>
          <span className={styles.text}>
            <span className={styles.label}>The whole playlist</span>
            <span className={styles.detail}>{playlistDetail}</span>
          </span>
          <span className={styles.chevron}>
            <StrokeIcon name="chevronRight" size={18} />
          </span>
        </button>
      </div>
    </div>
  );
}
