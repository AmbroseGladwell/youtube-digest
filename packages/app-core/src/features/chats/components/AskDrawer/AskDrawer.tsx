import { useLayoutEffect, useRef, useState } from "react";
import { chatOwner, type Chat } from "@overview/domain";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { CutText } from "../../../../components/shared/CutText/CutText.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { useTypingSettled } from "../../../analytics/useTypingSettled.js";
import { askHistoryGroups } from "../../util/askHistory.js";
import { chatMatchesQuery } from "../../util/chatMatchesQuery.js";
import { firstQuestionOf } from "../../util/conversationLine.js";
import { ConversationSearch } from "../ConversationSearch/ConversationSearch.js";
import styles from "./AskDrawer.module.scss";
import { askDrawerTestIds } from "./AskDrawerTestIds.js";

export interface AskDrawerProps {
  // The phone's sheet stays mounted and animates itself; the panel is mounted only while shown.
  open: boolean;
  motion: "arriving" | "still" | "leaving";
  chats: readonly Chat[];
  openChatId: string | null;
  now: Date;
  projectName: (projectId: string) => string | null;
  overviewTitle: (overviewId: string) => string | null;
  sheet: boolean;
  onNew: () => void;
  onOpen: (chat: Chat) => void;
  onDelete: (chat: Chat) => void;
  onClose: () => void;
  onSearched: (matches: number) => void;
}

const SEARCH_FROM = 2;

export const AskDrawer = ({
  open,
  motion,
  chats,
  openChatId,
  now,
  projectName,
  overviewTitle,
  sheet,
  onNew,
  onOpen,
  onDelete,
  onClose,
  onSearched,
}: AskDrawerProps) => {
  const root = useRef<HTMLDivElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuUp, setMenuUp] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useDismissOnOutside(menuFor !== null, () => setMenuFor(null), menu);

  useLayoutEffect(() => {
    if (menuFor === null) {
      return;
    }
    const item = menu.current?.parentElement?.getBoundingClientRect();
    const box = root.current?.getBoundingClientRect();
    const height = menu.current?.offsetHeight ?? 0;
    setMenuUp(item !== undefined && box !== undefined && item.bottom + height + 8 > Math.min(box.bottom, window.innerHeight));
  }, [menuFor]);
  const [query, setQuery] = useState("");
  const [heldHeight, setHeldHeight] = useState<number | null>(null);
  const searchable = chats.length >= SEARCH_FROM;

  const scopeOf = (chat: Chat) => {
    const owner = chatOwner(chat);
    if (owner.kind === "project") {
      return projectName(owner.id) ?? "A deleted project";
    }
    if (owner.kind === "overview") {
      return overviewTitle(owner.id) ?? "An overview you deleted";
    }
    return "Your library";
  };

  const shown = searchable ? chats.filter((chat) => chatMatchesQuery(chat, query, scopeOf(chat))) : chats;
  const groups = askHistoryGroups(shown, now);
  useTypingSettled(query, () => onSearched(shown.length));

  const newChat = (
    <button type="button" className={styles.newChat} onClick={onNew} data-testid={askDrawerTestIds.newChat}>
      <StrokeIcon name="plus" size={16} />
      New chat
    </button>
  );
  // On a phone the sheet keeps the height it had when a search starts, so it doesn't drop as results narrow.
  const searchFor = (next: string) => {
    const body = root.current;
    if (sheet && query === "" && next !== "" && body !== null) {
      const height = body.getBoundingClientRect().height;
      setHeldHeight(Math.min(height, body.parentElement?.getBoundingClientRect().height ?? height));
    }
    if (next === "") {
      setHeldHeight(null);
    }
    setQuery(next);
  };
  const search = (className: string | undefined) =>
    searchable && <ConversationSearch className={className} query={query} onQuery={searchFor} />;
  const conversations = (
    <>
      {searchable && query.trim() !== "" && shown.length === 0 && (
        <p className={styles.empty} role="status" data-testid={askDrawerTestIds.noMatches}>
          No conversations match “{query.trim()}”.
        </p>
      )}
      {chats.length === 0 && (
        <p className={styles.empty} data-testid={askDrawerTestIds.empty}>
          Your questions across your library, projects and overviews will be here.
        </p>
      )}
      {groups.map((group) => (
        <section key={group.label} className={styles.group} data-testid={askDrawerTestIds.group}>
          <h2 className={styles.groupLabel}>{group.label}</h2>
          <ul className={styles.items}>
            {group.chats.map((chat) => {
              const current = chat.id === openChatId;
              const question = firstQuestionOf(chat);
              return (
                <li
                  key={chat.id}
                  className={`${styles.item} ${current ? styles.current : ""} ${menuFor === chat.id ? styles.menuOpen : ""}`}
                  data-testid={askDrawerTestIds.item}
                >
                  <button
                    type="button"
                    className={styles.open}
                    aria-current={current ? "true" : undefined}
                    onClick={() => onOpen(chat)}
                    data-testid={askDrawerTestIds.open}
                  >
                    <CutText text={question} className={styles.question} testId={askDrawerTestIds.question} />
                    <span className={styles.scope} data-testid={askDrawerTestIds.scope}>
                      {scopeOf(chat)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.more}
                    aria-label={`More for “${question}”`}
                    aria-haspopup="menu"
                    aria-expanded={menuFor === chat.id}
                    onClick={() => setMenuFor(menuFor === chat.id ? null : chat.id)}
                    data-testid={askDrawerTestIds.menuButton}
                  >
                    <StrokeIcon name="more" size={16} />
                  </button>
                  {menuFor === chat.id && (
                    <div
                      className={`${styles.menu} ${menuUp ? styles.menuUp : ""}`}
                      ref={menu}
                      role="menu"
                      data-testid={askDrawerTestIds.menu}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.delete}
                        onClick={() => {
                          setMenuFor(null);
                          onDelete(chat);
                        }}
                        data-testid={askDrawerTestIds.delete}
                      >
                        <StrokeIcon name="trash" size={15} />
                        Delete conversation
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );

  if (sheet) {
    return (
      <BottomSheet open={open} title="Conversations" head={newChat} onClose={onClose} testId={askDrawerTestIds.root}>
        <div className={styles.sheetBody} ref={root} style={heldHeight === null ? undefined : { minHeight: heldHeight }}>
          {search(styles.sheetSearch)}
          {conversations}
        </div>
      </BottomSheet>
    );
  }

  return (
    <div
      className={`${styles.root} ${styles.panel} ${styles[motion] ?? ""}`}
      ref={root}
      role="dialog"
      aria-label="Conversations"
      data-scrolled={scrolled ? "" : undefined}
      onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
      data-testid={askDrawerTestIds.root}
    >
      <div className={styles.top} data-testid={askDrawerTestIds.top}>
        <button
          type="button"
          className={styles.close}
          aria-label="Hide conversations"
          aria-expanded="true"
          onClick={onClose}
          data-testid={askDrawerTestIds.close}
        >
          <StrokeIcon name="chatClose" size={18} />
        </button>
        {newChat}
        {search(styles.search)}
      </div>
      {conversations}
    </div>
  );
};
