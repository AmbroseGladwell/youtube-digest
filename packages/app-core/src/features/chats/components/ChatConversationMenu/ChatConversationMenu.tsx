import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  FOLLOW_UP_ASSISTANTS,
  chatHandOffPrompt,
  followUpHandOff,
  type Chat,
  type FollowUpAssistant,
  type Overview,
} from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { FollowUpAssistantMenu } from "../../../reader/components/FollowUpAssistantMenu/FollowUpAssistantMenu.js";
import { useFollowUpAssistant } from "../../../reader/useFollowUpAssistant.js";
import { handOffFollowUp } from "../../../reader/util/handOffFollowUp.js";
import styles from "./ChatConversationMenu.module.scss";
import { chatConversationMenuTestIds } from "./ChatConversationMenuTestIds.js";

export interface ChatConversationMenuProps {
  chat: Chat | null;
  overview: Overview;
  // Every conversation about this overview, this one included; offered only when there are others.
  conversations: number;
  // An answer is being written after earlier ones: only the finished answers are handed on.
  writing: boolean;
  compact: boolean;
  header: RefObject<HTMLElement | null>;
  onOpenList: () => void;
  onSaid: (text: string, done: boolean) => void;
  // OV-354, 354w: Search my library, remembered per conversation by its last question.
  searchLibrary: boolean;
  onSearchLibrary: (on: boolean) => void;
}

type Open = "closed" | "menu" | "choose";

const continueDetail = (assistant: FollowUpAssistant, connected: boolean, writing: boolean): ReactNode => {
  if (writing) {
    return "Sends the finished answers";
  }
  if (connected) {
    return (
      <>
        <span className={styles.connected}>Connected</span> · reads this conversation
      </>
    );
  }
  return FOLLOW_UP_ASSISTANTS[assistant].prefillParam === null
    ? "Copies this conversation; you paste it in"
    : "Opens with this conversation filled in";
};

// Design 324x–324ag: the chat header's ⋯, holding the overview's other conversations and
// Continue in {assistant}. A menu under the header on the web, an action sheet on a phone and in
// the panel. Hidden while it would hold nothing: a new conversation, alone, before its first answer.
export const ChatConversationMenu = ({
  chat,
  overview,
  conversations,
  writing,
  compact,
  header,
  onOpenList,
  onSaid,
  searchLibrary,
  onSearchLibrary,
}: ChatConversationMenuProps) => {
  const { assistant, connectedTo, anyConnection, choose } = useFollowUpAssistant();
  const analytics = useAnalytics();
  const [open, setOpen] = useState<Open>("closed");
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const sheet = useRef<HTMLDialogElement | null>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const detailId = useId();
  const returnFocus = useRef(false);

  const offerConversations = conversations > 1;
  const finished = chat !== null && chat.messages.some((message) => message.from === "answer") ? chat : null;

  const close = () => {
    returnFocus.current = true;
    setOpen("closed");
  };

  useDismissOnOutside(open === "menu" && !compact, close, menu, root);

  useEffect(() => {
    if (open !== "closed" || !returnFocus.current) {
      return;
    }
    returnFocus.current = false;
    trigger.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (open !== "menu") {
      return;
    }
    if (compact && sheet.current !== null && !sheet.current.open) {
      sheet.current.showModal();
    }
    items.current.find((item) => item instanceof HTMLButtonElement)?.focus({ preventScroll: true });
  }, [open, compact]);

  const continueIn = (to: FollowUpAssistant) => {
    if (finished === null) {
      return;
    }
    const connected = connectedTo(to);
    const handOff = followUpHandOff(to, chatHandOffPrompt(finished, overview, connected));
    const name = FOLLOW_UP_ASSISTANTS[to].name;
    analytics.reader.chat.continuedIn({ overviewId: overview.id, assistant: to, handOff: handOff.kind, connected });
    close();
    void handOffFollowUp(handOff).then((copied) => {
      if (handOff.kind === "prefill") {
        onSaid(`Opening ${name} in a new tab`, true);
      } else {
        onSaid(
          copied
            ? `Copied. ${name} is opening in a new tab: paste it there.`
            : `That couldn’t be copied. Copy the answers yourself, then paste them into ${name}.`,
          copied,
        );
      }
    });
  };

  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    const shown = items.current.filter((item) => item instanceof HTMLButtonElement);
    const current = shown.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) {
      return;
    }
    const last = shown.length - 1;
    const target = { ArrowDown: current === last ? 0 : current + 1, ArrowUp: current === 0 ? last : current - 1, Home: 0, End: last }[
      event.key
    ];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    shown[target]?.focus();
  };

  items.current = [];
  const list = (
    <div
      className={`${styles.menu} ${compact ? styles.inSheet : ""}`}
      ref={menu}
      role="menu"
      aria-label="More for this conversation"
      onKeyDown={keyDown}
      data-testid={chatConversationMenuTestIds.menu}
    >
      {compact && <span className={styles.handle} aria-hidden="true" />}
      {compact && <p className={styles.sheetLabel}>This conversation</p>}
      {offerConversations && (
        <button
          type="button"
          role="menuitem"
          ref={(element) => {
            items.current[0] = element;
          }}
          className={`${styles.item} ${styles.withCount}`}
          aria-label={`Conversations, ${conversations}`}
          onClick={() => {
            setOpen("closed");
            onOpenList();
          }}
          data-testid={chatConversationMenuTestIds.conversations}
        >
          <StrokeIcon name="chat" size={15} />
          <span className={styles.label}>Conversations</span>
          <span className={styles.count}>{conversations}</span>
        </button>
      )}
      {finished !== null &&
        (assistant === null ? (
          <button
            type="button"
            role="menuitem"
            aria-haspopup="dialog"
            aria-label="Continue in…"
            aria-describedby={detailId}
            ref={(element) => {
              items.current[1] = element;
            }}
            className={styles.item}
            onClick={() => setOpen("choose")}
            data-testid={chatConversationMenuTestIds.continueIn}
          >
            <StrokeIcon name="openOut" size={15} />
            <span className={styles.label}>Continue in…</span>
            <small className={styles.detail} id={detailId}>
              Choose an assistant; it’s remembered
            </small>
          </button>
        ) : (
          <button
            type="button"
            role="menuitem"
            ref={(element) => {
              items.current[1] = element;
            }}
            className={styles.item}
            aria-label={`Continue in ${FOLLOW_UP_ASSISTANTS[assistant].name} (opens in a new tab)`}
            aria-describedby={detailId}
            onClick={() => continueIn(assistant)}
            data-testid={chatConversationMenuTestIds.continueIn}
          >
            <StrokeIcon name="openOut" size={15} />
            <span className={styles.label}>Continue in {FOLLOW_UP_ASSISTANTS[assistant].name}</span>
            <small className={styles.detail} id={detailId} data-testid={chatConversationMenuTestIds.continueDetail}>
              {continueDetail(assistant, connectedTo(assistant) && FOLLOW_UP_ASSISTANTS[assistant].prefillParam !== null, writing)}
            </small>
          </button>
        ))}
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={searchLibrary}
        ref={(element) => {
          items.current[2] = element;
        }}
        className={`${styles.item} ${styles.switchItem}`}
        onClick={() => onSearchLibrary(!searchLibrary)}
        data-testid={chatConversationMenuTestIds.searchLibrary}
      >
        <StrokeIcon name="search" size={15} />
        <span className={styles.label}>Search my library</span>
        <span className={`${styles.switch} ${searchLibrary ? styles.switchOn : ""}`} aria-hidden="true">
          <span />
        </span>
        <small className={styles.detail}>
          {searchLibrary ? "On: up to 3 close overviews are read with each question" : "Off: only what you pin with \u201c@\u201d is read"}
        </small>
      </button>
      {finished !== null && assistant !== null && <p className={styles.foot}>Change the assistant in Settings › Connections.</p>}
    </div>
  );

  return (
    <div className={styles.root} ref={root} data-testid={chatConversationMenuTestIds.root}>
      <button
        type="button"
        ref={trigger}
        className={`${styles.trigger} ${open !== "closed" ? styles.triggerOpen : ""}`}
        aria-label="More for this conversation"
        aria-haspopup="menu"
        aria-expanded={open === "menu"}
        onClick={() => (open === "closed" ? setOpen("menu") : close())}
        data-testid={chatConversationMenuTestIds.trigger}
      >
        <StrokeIcon name="more" size={16} />
      </button>
      {open === "menu" &&
        (compact
          ? createPortal(
              <dialog
                ref={sheet}
                className={styles.sheet}
                aria-label="More for this conversation"
                onCancel={(event) => {
                  event.preventDefault();
                  close();
                }}
                onClick={(event) => {
                  if (event.target === sheet.current) {
                    close();
                  }
                }}
                data-testid={chatConversationMenuTestIds.sheet}
              >
                {list}
              </dialog>,
              document.body,
            )
          : list)}
      {open === "choose" && (
        // Escape here closes the chooser, never the chat behind it.
        <div onKeyDown={(event) => event.key === "Escape" && event.preventDefault()}>
          <FollowUpAssistantMenu
            firstTap={false}
            continueIn={true}
            chosen={null}
            offerHere={false}
            hereChosen={false}
            connectedTo={connectedTo}
            anyConnection={anyConnection}
            asSheet={compact}
            align="end"
            top={(header.current?.offsetHeight ?? 0) + 4}
            inside={root}
            onChoose={(to) => {
              choose(to, false);
              continueIn(to);
            }}
            onChooseHere={() => undefined}
            onCopyQuestion={() => undefined}
            onSetUpFollowed={() => undefined}
            onClose={close}
          />
        </div>
      )}
    </div>
  );
};
