import { useMemo, useRef, useState, type FormEvent } from "react";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useCaptureQueueQuery } from "../../../captureQueue/queries/captureQueueQuery.js";
import { youTubeLink } from "../../../newOverview/util/parseYouTubeUrl.js";
import { useOverviewsWithStateQuery } from "../../../overviews/queries/overviewsWithStateQuery.js";
import { readableEntries } from "../../../overviews/types/LibraryEntry.js";
import { useUnfollowPlaylistMutation } from "../../mutations/useUnfollowPlaylistMutation.js";
import { useFollowedPlaylistsQuery } from "../../queries/followedPlaylistsQuery.js";
import { FollowedPlaylistRow } from "../FollowedPlaylistRow/FollowedPlaylistRow.js";
import { FollowPlaylistDialog } from "../FollowPlaylistDialog/FollowPlaylistDialog.js";
import { PlaylistFollowFlow, type PlaylistTarget } from "../PlaylistFollowFlow/PlaylistFollowFlow.js";
import styles from "./PlaylistsSection.module.scss";
import { playlistsSectionTestIds } from "./PlaylistsSectionTestIds.js";

export const PLAYLISTS_INTRO =
  "Follow a public or unlisted playlist and its videos become overviews. New ones are queued each time you open The Overview.";

const NOT_A_PLAYLIST = "That doesn’t look like a YouTube playlist link.";

// A playlist link pasted here means the playlist, even when it opens one of its videos.
function settingsTargetOf(url: string): PlaylistTarget | null {
  const link = youTubeLink(url);
  if (link === null || link.kind === "video") return null;
  if (link.kind === "unfollowable") return { kind: "unfollowable", list: link.list, videoUrl: null };
  return { kind: "playlist", playlistId: link.playlistId };
}

// Design 27p–27s: the playlists this library follows, each with Unfollow, and a field to
// follow another. Empty, it teaches the habit the feature is built around
// (docs/features/playlists.md, "Settings").
export function PlaylistsSection() {
  const analytics = useAnalytics();
  const isPanel = useIsPanel();
  const isPhone = useIsPhone();
  const stacked = isPanel || isPhone;
  const followed = useFollowedPlaylistsQuery();
  const overviews = useOverviewsWithStateQuery();
  const queue = useCaptureQueueQuery();
  const unfollow = useUnfollowPlaylistMutation();
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [pasted, setPasted] = useState<{ target: PlaylistTarget; url: string } | null>(null);
  const followedLabel = useRef<HTMLParagraphElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const now = new Date();

  const overviewCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { overview } of readableEntries(overviews.data ?? [])) {
      if (overview.fromPlaylist !== null) counts.set(overview.fromPlaylist.id, (counts.get(overview.fromPlaylist.id) ?? 0) + 1);
    }
    return counts;
  }, [overviews.data]);

  const waitingFrom = (playlistId: string) =>
    (queue.data ?? []).filter((capture) => capture.status === "waiting" && capture.fromPlaylist.id === playlistId).length;

  const lookUp = (event: FormEvent) => {
    event.preventDefault();
    const target = settingsTargetOf(link);
    if (target === null) {
      setLinkError(NOT_A_PLAYLIST);
      return;
    }
    analytics.playlists.settings.lookupChosen();
    setLinkError(null);
    setPasted({ target, url: link.trim() });
  };

  const finishLookUp = () => {
    setPasted(null);
    setLink("");
    requestAnimationFrame(() => field.current?.focus());
  };

  if (isPanel && pasted !== null) {
    return (
      <div className={styles.inline} data-testid={playlistsSectionTestIds.inlineFlow}>
        <button type="button" className={styles.inlineBack} onClick={finishLookUp} data-testid={playlistsSectionTestIds.inlineBackButton}>
          <StrokeIcon name="arrowLeft" size={14} />
          Back
        </button>
        <PlaylistFollowFlow
          target={pasted.target}
          pastedUrl={pasted.url}
          from="settings"
          stacked
          onJustThisVideo={null}
          onPasteAnother={finishLookUp}
          onDone={finishLookUp}
        />
      </div>
    );
  }

  const list = followed.data ?? [];

  return (
    <div className={styles.root} data-testid={playlistsSectionTestIds.root}>
      {followed.isSuccess && list.length === 0 ? (
        <div className={styles.card} data-testid={playlistsSectionTestIds.empty}>
          <p className={styles.emptyTitle}>You’re not following any playlists</p>
          <p className={styles.emptyBody}>
            Try this: on YouTube, make an unlisted playlist called “Overview”. Whenever a video looks worth it, save it there
            instead of Watch Later. Paste the playlist’s link below, and each video you add becomes an overview the next
            time you open The Overview.
          </p>
        </div>
      ) : (
        <>
          <p className={styles.intro} data-testid={playlistsSectionTestIds.intro}>
            {PLAYLISTS_INTRO}
          </p>
          {unfollow.isError && (
            <p className={styles.error} role="alert" data-testid={playlistsSectionTestIds.unfollowError}>
              That playlist couldn’t be unfollowed. Try again.
            </p>
          )}
          {list.length > 0 && (
            <div className={styles.card}>
              <p className={styles.label} ref={followedLabel} tabIndex={-1} data-testid={playlistsSectionTestIds.followedLabel}>
                Following {list.length.toLocaleString("en-GB")}
              </p>
              <ul className={styles.list} aria-label="Followed playlists" data-testid={playlistsSectionTestIds.followedList}>
                {list.map(({ playlist, check }) => (
                  <FollowedPlaylistRow
                    key={playlist.id}
                    playlist={playlist}
                    check={check}
                    overviews={overviewCounts.get(playlist.id) ?? 0}
                    waiting={waitingFrom(playlist.id)}
                    stacked={stacked}
                    now={now}
                    onUnfollow={() =>
                      unfollow.mutate(playlist.id, {
                        onSuccess: ({ waitingRemoved }) => {
                          analytics.playlists.settings.unfollowed({ waitingRemoved });
                          requestAnimationFrame(() => (list.length > 1 ? followedLabel.current : field.current)?.focus());
                        },
                      })
                    }
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <form className={styles.card} onSubmit={lookUp}>
        <label className={styles.label} htmlFor="follow-playlist-link">
          Follow {list.length === 0 ? "a" : "another"} playlist
        </label>
        <span className={styles.field}>
          <input
            ref={field}
            id="follow-playlist-link"
            type="url"
            className={styles.input}
            placeholder="Paste a YouTube playlist link"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            aria-describedby="follow-playlist-help"
            data-testid={playlistsSectionTestIds.linkInput}
          />
          <button type="submit" className={styles.lookUp} data-testid={playlistsSectionTestIds.lookUpButton}>
            Look up
          </button>
        </span>
        {linkError !== null && (
          <p className={styles.error} role="alert" data-testid={playlistsSectionTestIds.linkError}>
            {linkError}
          </p>
        )}
        <p className={styles.help} id="follow-playlist-help">
          Public and unlisted playlists only. You’ll see what’s in it before anything is queued.
        </p>
      </form>

      {!isPanel && <FollowPlaylistDialog pasted={pasted} onClose={finishLookUp} />}
    </div>
  );
}
