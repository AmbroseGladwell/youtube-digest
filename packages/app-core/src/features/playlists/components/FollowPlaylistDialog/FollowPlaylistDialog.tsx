import { useEffect, useRef } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { PlaylistFollowFlow, type PlaylistTarget } from "../PlaylistFollowFlow/PlaylistFollowFlow.js";
import styles from "./FollowPlaylistDialog.module.scss";
import { followPlaylistDialogTestIds } from "./FollowPlaylistDialogTestIds.js";

export interface FollowPlaylistDialogProps {
  pasted: { target: PlaylistTarget; url: string } | null;
  onClose: () => void;
}

const HEADING_ID = "FollowPlaylistDialog-heading";

// Settings' Look up opens the same preview as the New dialog (27c), as a dialog on a wide
// screen and a sheet on a phone.
export function FollowPlaylistDialog({ pasted, onClose }: FollowPlaylistDialogProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const phone = useIsPhone();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (pasted !== null && !element.open) element.showModal();
    if (pasted === null && element.open) element.close();
  }, [pasted]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={HEADING_ID}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      data-testid={followPlaylistDialogTestIds.root}
    >
      {pasted !== null && (
        <div className={styles.panel}>
          <span className={styles.handle} aria-hidden="true" />
          <div className={styles.head}>
            <h2 className={styles.heading} id={HEADING_ID}>
              Follow a playlist
            </h2>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close" data-testid={followPlaylistDialogTestIds.closeButton}>
              <StrokeIcon name="close" size={16} />
            </button>
          </div>
          <PlaylistFollowFlow
            target={pasted.target}
            pastedUrl={pasted.url}
            from="settings"
            stacked={phone}
            onJustThisVideo={null}
            onPasteAnother={onClose}
            onDone={onClose}
          />
        </div>
      )}
    </dialog>
  );
}
