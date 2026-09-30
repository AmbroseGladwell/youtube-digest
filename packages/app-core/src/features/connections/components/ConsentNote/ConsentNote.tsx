import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./ConsentNote.module.scss";
import { consentNoteTestIds } from "./ConsentNoteTestIds.js";

export interface ConsentNoteProps {
  icon: StrokeIconName;
  title: string;
  body: string;
}

// Which device a link should be opened on, before it is sent and after it has landed
// (design 58e, 58f).
export function ConsentNote({ icon, title, body }: ConsentNoteProps) {
  return (
    <div className={styles.root} data-testid={consentNoteTestIds.root}>
      <span className={styles.icon}>
        <StrokeIcon name={icon} size={20} />
      </span>
      <div className={styles.text}>
        <p className={styles.title} data-testid={consentNoteTestIds.title}>
          {title}
        </p>
        <p className={styles.body}>{body}</p>
      </div>
    </div>
  );
}
