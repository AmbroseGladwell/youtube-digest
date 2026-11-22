import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { chatOwner, type Chat } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { askHistoryGroups } from "../../util/askHistory.js";
import { firstQuestionOf } from "../../util/conversationLine.js";
import styles from "./AskDrawer.module.scss";
import { askDrawerTestIds } from "./AskDrawerTestIds.js";

export interface AskDrawerProps {
  chats: readonly Chat[];
  openChatId: string | null;
  now: Date;
  // A project's name for its conversations' scope line, or null once it is deleted.
  projectName: (projectId: string) => string | null;
  sheet: boolean;
  // The button that opens it, so pressing it again closes it rather than reopening it.
  trigger: RefObject<HTMLElement | null>;
  onNew: () => void;
  onOpen: (chat: Chat) => void;
  onDelete: (chat: Chat) => void;
  onClose: () => void;
}

// OV-354, page 3 (354t-4 to 354t-7): New chat and every library and project conversation, grouped
// by when it was last asked in, each with its first question and its scope. Each has a ⋯ whose only
// item is Delete conversation; there's no Rename, because the title is the first question. On the
// web a raised column down the left of the page; on a phone a bottom sheet.
export const AskDrawer = ({ chats, openChatId, now, projectName, sheet, trigger, onNew, onOpen, onDelete, onClose }: AskDrawerProps) => {
  const root = useRef<HTMLDivElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuUp, setMenuUp] = useState(false);
  // On the web the drawer is a column beside the page, closed with its own button; as a sheet it
  // closes on a tap outside it.
  useDismissOnOutside(sheet && menuFor === null, onClose, root, trigger);
  useDismissOnOutside(menuFor !== null, () => setMenuFor(null), menu);

  // A conversation's menu opens below its ⋯, or above it when the drawer has no room below, as for
  // the last in a phone's sheet (OV-362).
  useLayoutEffect(() => {
    if (menuFor === null) {
      return;
    }
    const item = menu.current?.parentElement?.getBoundingClientRect();
    const box = root.current?.getBoundingClientRect();
    const height = menu.current?.offsetHeight ?? 0;
    setMenuUp(item !== undefined && box !== undefined && item.bottom + height + 8 > Math.min(box.bottom, window.innerHeight));
  }, [menuFor]);
  const groups = askHistoryGroups(chats, now);

  const scopeOf = (chat: Chat) => {
    const owner = chatOwner(chat);
    return owner.kind === "project" ? (projectName(owner.id) ?? "A deleted project") : "Your library";
  };

  return (
    <>
      {sheet && <div className={styles.scrim} aria-hidden="true" />}
      <div
        className={`${styles.root} ${sheet ? styles.sheet : styles.panel}`}
        ref={root}
        role="dialog"
        aria-label="Conversations"
        data-testid={askDrawerTestIds.root}
      >
        {sheet ? (
          <span className={styles.handle} aria-hidden="true" />
        ) : (
          <button
            type="button"
            className={styles.close}
            aria-label="Hide conversations"
            aria-expanded="true"
            onClick={onClose}
            data-testid={askDrawerTestIds.close}
          >
            <StrokeIcon name="panelClose" size={18} />
          </button>
        )}
        <button type="button" className={styles.newChat} onClick={onNew} data-testid={askDrawerTestIds.newChat}>
          <StrokeIcon name="plus" size={16} />
          New chat
        </button>
        {groups.length === 0 && (
          <p className={styles.empty} data-testid={askDrawerTestIds.empty}>
            Your questions across your library and projects will be here.
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
                      <span className={styles.question}>{question}</span>
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
      </div>
    </>
  );
};
