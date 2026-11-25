import { useRef } from "react";
import { ClearFieldButton } from "../../../../components/shared/ClearFieldButton/ClearFieldButton.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./ConversationSearch.module.scss";
import { conversationSearchTestIds } from "./ConversationSearchTestIds.js";

export interface ConversationSearchProps {
  query: string;
  onQuery: (query: string) => void;
  className?: string | undefined;
}

export const ConversationSearch = ({ query, onQuery, className = "" }: ConversationSearchProps) => {
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <div role="search" className={`${styles.root} ${className}`} data-testid={conversationSearchTestIds.root}>
      <span className={styles.icon} aria-hidden="true">
        <StrokeIcon name="search" size={15} />
      </span>
      <input
        ref={input}
        type="search"
        name="conversation-search"
        autoComplete="off"
        enterKeyHint="search"
        className={styles.input}
        placeholder="Search conversations"
        aria-label="Search conversations"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && query !== "") {
            event.preventDefault();
            event.stopPropagation();
            onQuery("");
          }
        }}
        data-testid={conversationSearchTestIds.input}
      />
      {query !== "" && (
        <ClearFieldButton
          label="Clear search"
          onClick={() => {
            onQuery("");
            input.current?.focus();
          }}
          testId={conversationSearchTestIds.clear}
        />
      )}
    </div>
  );
};
