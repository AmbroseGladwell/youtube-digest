import { FavouriteIcon } from "../../../../components/shared/FavouriteIcon/FavouriteIcon.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { SavedChip } from "../../../timeSaved/components/SavedChip/SavedChip.js";
import styles from "./NoteEndActions.module.scss";
import { noteEndActionsTestIds } from "./NoteEndActionsTestIds.js";

export interface NoteEndActionsProps {
  read: boolean;
  favourite: boolean;
  savedChip: { minutes: number; leaving: boolean } | null;
  onToggleRead: () => void;
  onToggleFavourite: () => void;
}

export function NoteEndActions({ read, favourite, savedChip, onToggleRead, onToggleFavourite }: NoteEndActionsProps) {
  return (
    <div className={styles.root} data-testid={noteEndActionsTestIds.root}>
      <div className={styles.buttons}>
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
      <div className={styles.saved}>
        {savedChip !== null && <SavedChip minutes={savedChip.minutes} countUp leaving={savedChip.leaving} />}
      </div>
    </div>
  );
}
