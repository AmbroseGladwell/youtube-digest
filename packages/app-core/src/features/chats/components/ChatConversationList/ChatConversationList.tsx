import { useRef, useState } from "react";
import type { Chat } from "@overview/domain";
import { CutText } from "../../../../components/shared/CutText/CutText.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useTypingSettled } from "../../../analytics/useTypingSettled.js";
import { chatMatchesQuery } from "../../util/chatMatchesQuery.js";
import { conversationLine, firstQuestionOf, lastActive } from "../../util/conversationLine.js";
import { ConversationSearch } from "../ConversationSearch/ConversationSearch.js";
import styles from "./ChatConversationList.module.scss";
import { chatConversationListTestIds } from "./ChatConversationListTestIds.js";

export interface ChatConversationListProps {
  chats: readonly Chat[];
  openChatId: string | null;
  now: Date;
  onNew: () => void;
  onOpen: (chat: Chat) => void;
  onDelete: (chat: Chat) => void;
  onSearched?: (matches: number) => void;
}

const SEARCH_FROM = 2;

export const ChatConversationList = ({ chats, openChatId, now, onNew, onOpen, onDelete, onSearched }: ChatConversationListProps) => {
  const [query, setQuery] = useState("");
  const searchable = chats.length >= SEARCH_FROM;
  const rows = [...chats]
    .filter((chat) => !searchable || chatMatchesQuery(chat, query))
    .sort((a, b) => lastActive(b).localeCompare(lastActive(a)));
  const openButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const newButton = useRef<HTMLButtonElement | null>(null);

  useTypingSettled(query, () => onSearched?.(rows.length));

  const remove = (chat: Chat, index: number) => {
    onDelete(chat);
    requestAnimationFrame(() => (openButtons.current[index + 1] ?? openButtons.current[index - 1] ?? newButton.current)?.focus());
  };

  return (
    <div className={styles.root} data-testid={chatConversationListTestIds.root}>
      <button
        type="button"
        ref={newButton}
        className={styles.newButton}
        onClick={onNew}
        data-testid={chatConversationListTestIds.newConversation}
      >
        <StrokeIcon name="pencil" size={16} />
        New conversation
      </button>
      {searchable && <ConversationSearch className={styles.search} query={query} onQuery={setQuery} />}
      {searchable && query.trim() !== "" && rows.length === 0 && (
        <p className={styles.noMatches} role="status" data-testid={chatConversationListTestIds.noMatches}>
          No conversations match “{query.trim()}”.
        </p>
      )}
      <ul className={styles.rows}>
        {rows.map((chat, index) => (
          <li
            key={chat.id}
            className={`${styles.row} ${chat.id === openChatId ? styles.rowOpen : ""}`}
            data-testid={chatConversationListTestIds.row}
          >
            <button
              type="button"
              ref={(element) => {
                openButtons.current[index] = element;
              }}
              className={styles.open}
              aria-current={chat.id === openChatId ? "true" : undefined}
              onClick={() => onOpen(chat)}
              data-testid={chatConversationListTestIds.open}
            >
              <CutText text={firstQuestionOf(chat)} className={styles.title} />
              <span className={styles.meta} data-testid={chatConversationListTestIds.meta}>
                {conversationLine(chat, now)}
              </span>
            </button>
            <button
              type="button"
              className={styles.delete}
              aria-label={`Delete conversation: ${firstQuestionOf(chat)}`}
              onClick={() => remove(chat, index)}
              data-testid={chatConversationListTestIds.delete}
            >
              <StrokeIcon name="trash" size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
