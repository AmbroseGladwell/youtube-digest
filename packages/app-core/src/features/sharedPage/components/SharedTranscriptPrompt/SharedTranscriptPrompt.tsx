import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./SharedTranscriptPrompt.module.scss";
import { sharedTranscriptPromptTestIds } from "./SharedTranscriptPromptTestIds.js";

export interface SharedTranscriptPromptProps {
  label: string;
  saving: boolean;
  onSave: () => void;
}

// Why no transcript: docs/features/sharing.md, "What is in a shared copy, and what is not".
export const SharedTranscriptPrompt = ({ label, saving, onSave }: SharedTranscriptPromptProps) => {
  return (
    <section className={styles.root} data-testid={sharedTranscriptPromptTestIds.root}>
      <h2 className={styles.heading}>The full transcript comes with your own copy</h2>
      <p className={styles.body}>
        A shared link carries the overview. Save it to your overviews and the transcript is fetched for you, with every line timed and
        searchable.
      </p>
      <button type="button" className={styles.save} onClick={onSave} disabled={saving} data-testid={sharedTranscriptPromptTestIds.save}>
        {label}
        <StrokeIcon name="bookmark" size={16} />
      </button>
    </section>
  );
};
