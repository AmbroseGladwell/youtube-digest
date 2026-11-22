import { markedWords } from "../../util/inlineMarks.js";
import { streamedParagraphs } from "../../util/streamedParagraphs.js";
import styles from "./ChatStreamedText.module.scss";
import { chatStreamedTextTestIds } from "./ChatStreamedTextTestIds.js";

export interface ChatStreamedTextProps {
  text: string;
  whole: boolean;
}

// OV-341: each word fades in as it arrives, in the final answer's paragraphs, so nothing moves when it
// lands. Bold shows as it is written, never its asterisks (OV-362).
export function ChatStreamedText({ text, whole }: ChatStreamedTextProps) {
  return (
    <div className={styles.root} data-testid={chatStreamedTextTestIds.root}>
      {streamedParagraphs(text, whole).map((words, paragraph) => (
        <p key={paragraph}>
          {markedWords(words, whole).map((word, index) =>
            word.bold ? (
              <strong key={index} className={styles.word}>
                {word.text}
              </strong>
            ) : (
              <span key={index} className={styles.word}>
                {word.text}
              </span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
