import { forwardRef, useId, type KeyboardEvent } from "react";
import { MAX_CHAT_QUESTION_LENGTH } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./ChatField.module.scss";
import { chatFieldTestIds } from "./ChatFieldTestIds.js";

export interface ChatFieldProps {
  value: string;
  placeholder: string;
  answering: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
}

// Design 310i–310j: Enter sends and Shift+Enter starts a new line; while an answer is being
// written, Stop (ink, never orange) takes Send's place.
export const ChatField = forwardRef<HTMLTextAreaElement, ChatFieldProps>(function ChatField(
  { value, placeholder, answering, onChange, onSend, onStop },
  ref,
) {
  const id = useId();
  const ready = value.trim() !== "" && !answering;

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (ready) onSend();
  };

  return (
    <div className={styles.root}>
      <label className={styles.label} htmlFor={id}>
        {placeholder}
      </label>
      <textarea
        ref={ref}
        id={id}
        name="chat-question"
        enterKeyHint="send"
        autoComplete="off"
        rows={1}
        className={styles.input}
        value={value}
        placeholder={placeholder}
        maxLength={MAX_CHAT_QUESTION_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={keyDown}
        data-testid={chatFieldTestIds.input}
      />
      {answering ? (
        <button type="button" className={styles.stop} onClick={onStop} data-testid={chatFieldTestIds.stop}>
          <span className={styles.stopMark} aria-hidden="true" />
          Stop
        </button>
      ) : (
        <button
          type="button"
          className={`${styles.send} ${ready ? styles.sendReady : ""}`}
          aria-label="Send"
          aria-disabled={!ready}
          onClick={() => ready && onSend()}
          data-testid={chatFieldTestIds.send}
        >
          <StrokeIcon name="arrowUp" size={18} />
        </button>
      )}
    </div>
  );
});
