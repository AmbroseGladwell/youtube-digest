import { useEffect, useMemo } from "react";
import type { PlaylistId } from "@overview/domain";
import { isSyncRequestError } from "@overview/sync";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useCaptureQueueQuery } from "../../../captureQueue/queries/captureQueueQuery.js";
import type { UnfollowableList } from "../../../newOverview/util/parseYouTubeUrl.js";
import { useOverviewsWithStateQuery } from "../../../overviews/queries/overviewsWithStateQuery.js";
import { readableEntries } from "../../../overviews/types/LibraryEntry.js";
import { useFollowPlaylistMutation } from "../../mutations/useFollowPlaylistMutation.js";
import { useFollowedPlaylistsQuery } from "../../queries/followedPlaylistsQuery.js";
import { usePlaylistLookupQuery } from "../../queries/playlistLookupQuery.js";
import { playlistPreview } from "../../util/playlistPreview.js";
import { PastedLink } from "../PastedLink/PastedLink.js";
import { PlaylistPreview } from "../PlaylistPreview/PlaylistPreview.js";
import { PlaylistRefusal, type PlaylistRefusalReason } from "../PlaylistRefusal/PlaylistRefusal.js";
import styles from "./PlaylistFollowFlow.module.scss";
import { playlistFollowFlowTestIds } from "./PlaylistFollowFlowTestIds.js";

export type PlaylistTarget =
  | { kind: "playlist"; playlistId: PlaylistId }
  | { kind: "unfollowable"; list: UnfollowableList; videoUrl: string | null };

export type PlaylistFlowEntry = "dialog" | "home" | "settings";

export interface PlaylistFollowFlowProps {
  target: PlaylistTarget;
  pastedUrl: string;
  from: PlaylistFlowEntry;
  stacked: boolean;
  // Mix links almost always carry a video, and "Just this video" makes its overview.
  onJustThisVideo: ((videoUrl: string) => void) | null;
  onPasteAnother: () => void;
  onDone: () => void;
}

function refusalOf(error: unknown): PlaylistRefusalReason {
  if (!isSyncRequestError(error)) return "lookupFailed";
  if (error.code === "playlist_private") return "private";
  if (error.code === "playlist_not_found") return "gone";
  if (error.code === "unavailable") return "unavailable";
  return "lookupFailed";
}

// A pasted playlist, from lookup to following (designs 27b–27h): a short honest wait, then
// the preview, or the reason it can't be followed and what to do instead.
export function PlaylistFollowFlow({ target, pastedUrl, from, stacked, onJustThisVideo, onPasteAnother, onDone }: PlaylistFollowFlowProps) {
  const analytics = useAnalytics();
  const lookup = usePlaylistLookupQuery(target.kind === "playlist" ? target.playlistId : null);
  const overviews = useOverviewsWithStateQuery();
  const queue = useCaptureQueueQuery();
  const followed = useFollowedPlaylistsQuery();
  const follow = useFollowPlaylistMutation();

  const held = useMemo(
    () =>
      new Set<string>([
        ...readableEntries(overviews.data ?? []).flatMap(({ overview }) => (overview.video.id === null ? [] : [overview.video.id])),
        ...(queue.data ?? []).map((capture) => capture.videoId),
      ]),
    [overviews.data, queue.data],
  );

  const refusal: PlaylistRefusalReason | null =
    target.kind === "unfollowable"
      ? target.list
      : lookup.isError
        ? refusalOf(lookup.error)
        : lookup.data !== undefined && lookup.data.entries.length === 0
          ? "empty"
          : null;

  useEffect(() => {
    if (refusal !== null && refusal !== "empty") analytics.playlists.preview.refused({ from, reason: refusal });
  }, [refusal, from, analytics]);

  const followLookup = (backfill: boolean) => {
    if (lookup.data === undefined) return;
    const preview = playlistPreview(lookup.data, held);
    follow.mutate(
      { lookup: lookup.data, backfill },
      {
        onSuccess: ({ queued }) => {
          analytics.playlists.preview.followed({ from, backfill, videos: preview.total, queued });
          onDone();
        },
      },
    );
  };

  const body = (() => {
    if (refusal !== null) {
      const action =
        refusal === "mix" && target.kind === "unfollowable" && target.videoUrl !== null && onJustThisVideo !== null
          ? { label: "Just this video", onSelect: () => onJustThisVideo(target.videoUrl!) }
          : refusal === "empty"
            ? { label: "Follow it anyway", onSelect: () => followLookup(false), busy: follow.isPending }
            : refusal === "lookupFailed"
              ? { label: "Try again", onSelect: () => void lookup.refetch() }
              : null;
      return <PlaylistRefusal reason={refusal} stacked={stacked} action={action} onPasteAnother={onPasteAnother} />;
    }

    if (lookup.data === undefined) {
      return (
        <>
          <p className={styles.status} role="status" data-testid={playlistFollowFlowTestIds.lookingUp}>
            <span className={styles.dot} aria-hidden="true" />
            Looking up the playlist…
          </p>
          <div className={styles.skeleton} aria-hidden="true">
            <span className={styles.bar} style={{ width: "40%", height: "1.625rem" }} />
            <span className={styles.bar} style={{ width: "28%" }} />
            <span className={styles.skeletonCard}>
              <span className={styles.bar} style={{ width: "55%" }} />
              <span className={styles.bar} style={{ width: "48%" }} />
              <span className={styles.bar} style={{ width: "62%" }} />
            </span>
          </div>
        </>
      );
    }

    return (
      <PlaylistPreview
        lookup={lookup.data}
        preview={playlistPreview(lookup.data, held)}
        alreadyFollowing={(followed.data ?? []).some(({ playlist }) => playlist.id === lookup.data.id)}
        stacked={stacked}
        busy={follow.isPending}
        onFollow={followLookup}
        onCancel={() => {
          analytics.playlists.preview.cancelled({ from });
          onDone();
        }}
      />
    );
  })();

  return (
    <div className={styles.root} data-testid={playlistFollowFlowTestIds.root}>
      <PastedLink url={pastedUrl} />
      {body}
      {follow.isError && (
        <p className={styles.error} role="alert" data-testid={playlistFollowFlowTestIds.followError}>
          The playlist couldn’t be followed. Try again.
        </p>
      )}
    </div>
  );
}
