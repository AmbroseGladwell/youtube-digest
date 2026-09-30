import { readSharedPageIntent } from "../../util/sharedPageIntent.js";
import { sharedPageIntentNote } from "../../util/sharedPageIntentNote.js";
import styles from "./SharedPageIntentCard.module.scss";
import { sharedPageIntentCardTestIds } from "./SharedPageIntentCardTestIds.js";

// Design 30l's stone note. Absent for everyone who did not arrive from a shared page,
// which is most people (docs/features/sharing.md).
export function SharedPageIntentCard() {
  const note = sharedPageIntentNote(readSharedPageIntent());
  if (note === null) {
    return null;
  }

  return (
    <div className={styles.root} data-testid={sharedPageIntentCardTestIds.root}>
      <p className={styles.label} data-testid={sharedPageIntentCardTestIds.label}>
        {note.label}
      </p>
      <span className={styles.body} data-testid={sharedPageIntentCardTestIds.body}>
        {note.body}
      </span>
    </div>
  );
}
