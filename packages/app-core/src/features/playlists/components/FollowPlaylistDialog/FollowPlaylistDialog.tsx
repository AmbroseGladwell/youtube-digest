import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { useKeptWhileClosing } from "../../../../util/useKeptWhileClosing.js";
import { PlaylistFollowFlow, type PlaylistTarget } from "../PlaylistFollowFlow/PlaylistFollowFlow.js";
import styles from "./FollowPlaylistDialog.module.scss";
import { followPlaylistDialogTestIds } from "./FollowPlaylistDialogTestIds.js";

export interface FollowPlaylistDialogProps {
  pasted: { target: PlaylistTarget; url: string } | null;
  onClose: () => void;
}

export const FollowPlaylistDialog = ({ pasted, onClose }: FollowPlaylistDialogProps) => {
  const phone = useIsPhone();
  const shown = useKeptWhileClosing(pasted);

  return (
    <BottomSheet open={shown.open} title="Follow a playlist" onClose={onClose} wide="dialog" testId={followPlaylistDialogTestIds.root}>
      {shown.kept !== null && (
        <div className={styles.content}>
          <PlaylistFollowFlow
            target={shown.kept.target}
            pastedUrl={shown.kept.url}
            from="settings"
            stacked={phone}
            onJustThisVideo={null}
            onPasteAnother={onClose}
            onDone={onClose}
          />
        </div>
      )}
    </BottomSheet>
  );
};
