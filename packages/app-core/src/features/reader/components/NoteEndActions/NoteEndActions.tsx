import { FavouriteIcon } from "../../../../components/shared/FavouriteIcon/FavouriteIcon.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./NoteEndActions.module.scss";
import { noteEndActionsTestIds } from "./NoteEndActionsTestIds.js";

export interface NoteEndActionsProps {
  read: boolean;
  favourite: boolean;
  onToggleRead: () => void;
  onToggleFavourite: () => void;
}

export function NoteEndActions({ read, favourite, onToggleRead, onToggleFavourite }: NoteEndActionsProps) {
  return (
    <div className={styles.root} data-testid={noteEndActionsTestIds.root}>
      <button
        type="button"
        className={`${styles.read} ${read ? styles.readActive : ""}`}
        onClick={onToggleRead}
        aria-pressed={read}
        data-testid={noteEndActionsTestIds.readButton}
      >
        {read && <StrokeIcon name="check" />}
        {read ? "Read" : "Mark read"}
      </button>
      <button
        type="button"
        className={styles.favourite}
        onClick={onToggleFavourite}
        aria-pressed={favourite}
        aria-label={favourite ? "Favourited" : "Favourite"}
        data-testid={noteEndActionsTestIds.favouriteButton}
      >
        <FavouriteIcon filled={favourite} />
      </button>
    </div>
  );
}
