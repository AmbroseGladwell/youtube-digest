import { Link } from "react-router";
import type { Overview, PlaylistOrigin } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { playlistUrl } from "../../../newOverview/util/parseYouTubeUrl.js";
import { useFollowedPlaylistsQuery } from "../../queries/followedPlaylistsQuery.js";
import styles from "./PlaylistFromLine.module.scss";
import { playlistFromLineTestIds } from "./PlaylistFromLineTestIds.js";

// Design 27t–27u: where the overview came from, on the byline's scale so it reads as
// provenance rather than verdict. The name opens the playlist on YouTube and Manage opens
// Settings while it is followed. Unfollowed, Manage goes; gone from YouTube, the name is
// plain text. Stored on the overview, so it survives unfollowing and syncs.
export function PlaylistFromLine({ overview }: { overview: Overview }) {
  return overview.fromPlaylist === null ? null : <FromLine overview={overview} origin={overview.fromPlaylist} />;
}

function FromLine({ overview, origin }: { overview: Overview; origin: PlaylistOrigin }) {
  const analytics = useAnalytics();
  const followed = useFollowedPlaylistsQuery();

  const following = (followed.data ?? []).find(({ playlist }) => playlist.id === origin.id)?.playlist ?? null;
  const gone = following?.unavailable != null;

  return (
    <p className={styles.root} data-testid={playlistFromLineTestIds.root}>
      <span className={styles.icon} aria-hidden="true">
        <StrokeIcon name="listVideo" size={15} />
      </span>
      <span>
        From{" "}
        {gone ? (
          <span className={styles.name} data-testid={playlistFromLineTestIds.playlistName}>
            {origin.title}
          </span>
        ) : (
          <a
            className={styles.name}
            href={playlistUrl(origin.id)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open the ${origin.title} playlist on YouTube`}
            onClick={() => analytics.playlists.fromLine.playlistOpened({ overviewId: overview.id })}
            data-testid={playlistFromLineTestIds.playlistLink}
          >
            {origin.title}
          </a>
        )}{" "}
        playlist
        {gone && <span data-testid={playlistFromLineTestIds.goneNote}> · no longer on YouTube</span>}
      </span>
      {following !== null && !gone && (
        <>
          <span aria-hidden="true">·</span>
          <Link
            className={styles.manage}
            to={Routes.settingsSection("playlists")}
            aria-label="Manage followed playlists"
            onClick={() => analytics.playlists.fromLine.manageChosen({ overviewId: overview.id })}
            data-testid={playlistFromLineTestIds.manageLink}
          >
            Manage
          </Link>
        </>
      )}
    </p>
  );
}
