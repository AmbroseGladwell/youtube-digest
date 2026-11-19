import { streamedParagraphs } from "../../util/streamedParagraphs.js";
import styles from "./ChatStreamedText.module.scss";
import { chatStreamedTextTestIds } from "./ChatStreamedTextTestIds.js";

export interface ChatStreamedTextProps {
  text: string;
  whole: boolean;
}

// OV-341: each word fades in as it arrives, in the final answer's paragraphs, so nothing moves when it lands.
export function ChatStreamedText({ text, whole }: ChatStreamedTextProps) {
  return (
    <div className={styles.root} data-testid={chatStreamedTextTestIds.root}>
      {streamedParagraphs(text, whole).map((words, paragraph) => (
        <p key={paragraph}>
          {words.map((word, index) => (
            <span key={index} className={styles.word}>
              {word}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
