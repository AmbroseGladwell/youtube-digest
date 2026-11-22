import type { Overview, PlaylistOrigin } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { playlistUrl } from "../../../newOverview/util/parseYouTubeUrl.js";
import { useFollowedPlaylistsQuery } from "../../queries/followedPlaylistsQuery.js";
import styles from "./PlaylistFromLine.module.scss";
import { playlistFromLineTestIds } from "./PlaylistFromLineTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

// Stored on the overview, so it survives unfollowing and syncs (27t–27u).
export const PlaylistFromLine = ({ overview }: { overview: Overview }) => {
  return overview.fromPlaylist === null ? null : <FromLine overview={overview} origin={overview.fromPlaylist} />;
};

interface FromLineProps {
  overview: Overview;
  origin: PlaylistOrigin;
}

const FromLine = ({ overview, origin }: FromLineProps) => {
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
          <PageLink
            className={styles.manage}
            to={Routes.settingsSection("playlists")}
            aria-label="Manage followed playlists"
            onClick={() => analytics.playlists.fromLine.manageChosen({ overviewId: overview.id })}
            data-testid={playlistFromLineTestIds.manageLink}
          >
            Manage
          </PageLink>
        </>
      )}
    </p>
  );
};
