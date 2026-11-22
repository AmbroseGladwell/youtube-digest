import { useId, type KeyboardEvent, type Ref } from "react";
import { MAX_CHAT_QUESTION_LENGTH } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./ChatField.module.scss";
import { chatFieldTestIds } from "./ChatFieldTestIds.js";

export interface ChatFieldProps {
  ref?: Ref<HTMLTextAreaElement> | undefined;
  value: string;
  placeholder: string;
  answering: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  // OV-354: the "@" button, and the field acting as the picker's combobox while it's open.
  onAt?: (() => void) | undefined;
  onPickerKey?: ((event: KeyboardEvent<HTMLTextAreaElement>) => boolean) | undefined;
  combobox?: { expanded: boolean; controls: string; activeDescendant: string | undefined } | undefined;
  // The Ask page's empty state, where the field stands alone in the middle (354u).
  large?: boolean | undefined;
}

// Design 310i–310j: Enter sends and Shift+Enter starts a new line; while an answer is being
// written, Stop (ink, never orange) takes Send's place.
export const ChatField = ({
  value,
  placeholder,
  answering,
  onChange,
  onSend,
  onStop,
  onAt,
  onPickerKey,
  combobox,
  large = false,
  ref,
}: ChatFieldProps) => {
  const id = useId();
  const ready = value.trim() !== "" && !answering;

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (onPickerKey?.(event)) return;
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (ready) onSend();
  };

  return (
    <div className={`${styles.root} ${large ? styles.large : ""}`}>
      <label className={styles.label} htmlFor={id}>
        {placeholder}
      </label>
      {onAt === undefined ? null : (
        <button
          type="button"
          className={styles.at}
          aria-label="Add an overview or project"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onAt}
          data-testid={chatFieldTestIds.at}
        >
          <StrokeIcon name="at" size={15} />
        </button>
      )}
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
        {...(combobox === undefined
          ? {}
          : {
              role: "combobox",
              "aria-autocomplete": "list" as const,
              "aria-expanded": combobox.expanded,
              "aria-controls": combobox.controls,
              "aria-activedescendant": combobox.activeDescendant,
            })}
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
};
