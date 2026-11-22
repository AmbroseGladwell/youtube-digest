import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { chatOwner, type Chat } from "@overview/domain";
import { CutText } from "../../../../components/shared/CutText/CutText.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { askHistoryGroups } from "../../util/askHistory.js";
import { firstQuestionOf } from "../../util/conversationLine.js";
import styles from "./AskDrawer.module.scss";
import { askDrawerTestIds } from "./AskDrawerTestIds.js";

export interface AskDrawerProps {
  // Sliding in when the reader opens it, out when they close it, or still when it starts open (OV-371).
  motion: "arriving" | "still" | "leaving";
  chats: readonly Chat[];
  openChatId: string | null;
  now: Date;
  // A project's name for its conversations' scope line, or null once it is deleted.
  projectName: (projectId: string) => string | null;
  // An overview's title for its conversations' scope line, or null when it isn't on this device.
  overviewTitle: (overviewId: string) => string | null;
  sheet: boolean;
  // The button that opens it, so pressing it again closes it rather than reopening it.
  trigger: RefObject<HTMLElement | null>;
  onNew: () => void;
  onOpen: (chat: Chat) => void;
  onDelete: (chat: Chat) => void;
  onClose: () => void;
}

// OV-354, page 3 (354t-4 to 354t-7): New chat and every conversation, the library's, projects' and
// overviews' (OV-363), grouped by when it was last asked in, each with its first question and its
// scope: "Your library", the project's name or the overview's title. Each has a ⋯ whose only
// item is Delete conversation; there's no Rename, because the title is the first question. On the
// web a raised column down the left of the page; on a phone a bottom sheet.
export function AskDrawer({
  motion,
  chats,
  openChatId,
  now,
  projectName,
  overviewTitle,
  sheet,
  trigger,
  onNew,
  onOpen,
  onDelete,
  onClose,
}: AskDrawerProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuUp, setMenuUp] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // On the web the drawer is a column beside the page, closed with its own button; as a sheet it
  // closes on a tap outside it.
  useDismissOnOutside(sheet && menuFor === null, onClose, root, trigger);
  useDismissOnOutside(menuFor !== null, () => setMenuFor(null), menu);

  // A conversation's menu opens below its ⋯, or above it when the drawer has no room below, as for
  // the last in a phone's sheet (OV-362).
  useLayoutEffect(() => {
    if (menuFor === null) return;
    const item = menu.current?.parentElement?.getBoundingClientRect();
    const box = root.current?.getBoundingClientRect();
    const height = menu.current?.offsetHeight ?? 0;
    setMenuUp(item !== undefined && box !== undefined && item.bottom + height + 8 > Math.min(box.bottom, window.innerHeight));
  }, [menuFor]);
  const groups = askHistoryGroups(chats, now);

  const scopeOf = (chat: Chat) => {
    const owner = chatOwner(chat);
    if (owner.kind === "project") return projectName(owner.id) ?? "A deleted project";
    if (owner.kind === "overview") return overviewTitle(owner.id) ?? "An overview you deleted";
    return "Your library";
  };

  return (
    <>
      {sheet && <div className={`${styles.scrim} ${styles[motion] ?? ""}`} aria-hidden="true" />}
      <div
        className={`${styles.root} ${sheet ? styles.sheet : styles.panel} ${styles[motion] ?? ""}`}
        ref={root}
        role="dialog"
        aria-label="Conversations"
        data-scrolled={scrolled ? "" : undefined}
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
        data-testid={askDrawerTestIds.root}
      >
        <div className={styles.top} data-testid={askDrawerTestIds.top}>
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
        </div>
        {groups.length === 0 && (
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
      </div>
    </>
  );
}
