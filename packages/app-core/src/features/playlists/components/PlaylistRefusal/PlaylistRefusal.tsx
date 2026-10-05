import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./PlaylistRefusal.module.scss";
import { playlistRefusalTestIds } from "./PlaylistRefusalTestIds.js";

export type PlaylistRefusalReason = "private" | "watchLater" | "liked" | "mix" | "empty" | "gone" | "unavailable" | "lookupFailed";

const COPY: Record<PlaylistRefusalReason, { title: string; body: string }> = {
  private: {
    title: "This playlist is private",
    body: "We can only follow public or unlisted playlists. On YouTube, set it to Unlisted (only people with the link can find it), then paste the link again.",
  },
  watchLater: {
    title: "YouTube keeps Watch Later to itself",
    body: "YouTube doesn’t share Watch Later with apps. Make an unlisted playlist called “Overview”, save videos there instead, and paste its link here.",
  },
  liked: {
    title: "YouTube keeps Liked videos to itself",
    body: "YouTube doesn’t share Liked videos with apps. Make an unlisted playlist called “Overview”, save videos there instead, and paste its link here.",
  },
  mix: {
    title: "Mixes can’t be followed",
    body: "YouTube makes a Mix on the fly for each viewer and doesn’t share it with apps. You can still make an overview of the video this link opens.",
  },
  empty: {
    title: "This playlist is empty",
    body: "There’s nothing in it yet. Follow it anyway and anything you add on YouTube is queued the next time you open The Overview.",
  },
  gone: {
    title: "We can’t find this playlist",
    body: "It may have been deleted, or the link is cut short. Check it on YouTube and paste it again.",
  },
  unavailable: {
    title: "Playlists can’t be looked up here",
    body: "This server can’t read YouTube playlists right now. You can still paste a single video’s link.",
  },
  lookupFailed: {
    title: "We couldn’t look this playlist up",
    body: "Something went wrong reaching YouTube. Check your connection and try again.",
  },
};

export interface PlaylistRefusalProps {
  reason: PlaylistRefusalReason;
  stacked: boolean;
  // The one recovery that can work for this reason, when there is one.
  action: { label: string; onSelect: () => void; busy?: boolean } | null;
  onPasteAnother: () => void;
}

// The error-state pattern (design 19, 27g): a short orange bar, a plain title, the reason,
// then the recovery. Recovery first where it stacks.
export function PlaylistRefusal({ reason, stacked, action, onPasteAnother }: PlaylistRefusalProps) {
  const { title, body } = COPY[reason];
  return (
    <>
      <div className={styles.root} role="alert" data-testid={playlistRefusalTestIds.root}>
        <span className={styles.bar} aria-hidden="true" />
        <h3 className={styles.title} data-testid={playlistRefusalTestIds.title}>
          {title}
        </h3>
        <p className={styles.body} data-testid={playlistRefusalTestIds.body}>
          {body}
        </p>
      </div>
      <div className={`${styles.actions} ${stacked ? styles.actionsStacked : ""}`}>
        {action !== null && (
          <button
            type="button"
            className={styles.primary}
            onClick={action.onSelect}
            disabled={action.busy === true}
            data-testid={playlistRefusalTestIds.actionButton}
          >
            {action.label}
          </button>
        )}
        <button
          type="button"
          className={action === null ? styles.secondary : styles.ghost}
          onClick={onPasteAnother}
          data-testid={playlistRefusalTestIds.pasteAnotherButton}
        >
          <StrokeIcon name="arrowLeft" size={14} />
          Paste another link
        </button>
      </div>
    </>
  );
}
