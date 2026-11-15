import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { FOLLOW_UP_ASSISTANTS, FollowUpAssistant } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { prefersReducedMotion } from "../../../../util/prefersReducedMotion.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import styles from "./FollowUpAssistantMenu.module.scss";
import { followUpAssistantMenuTestIds } from "./FollowUpAssistantMenuTestIds.js";

export const ASK_IN_TITLE = "Ask in";
export const CHANGE_TITLE = "Ask follow-up questions in";
export const SET_UP_NOTE =
  "Connect your assistant to The Overview and it can read the whole transcript, search your library, save to projects and more.";

export interface FollowUpAssistantMenuProps {
  // The first tap asks as soon as one is picked, and offers Copy question; Change only chooses (266s, 266v).
  firstTap: boolean;
  chosen: FollowUpAssistant | null;
  connectedTo: (assistant: FollowUpAssistant) => boolean;
  anyConnection: boolean;
  asSheet: boolean;
  // Where the menu stands, from the top of the block, when it floats on the web.
  top: number;
  inside: RefObject<HTMLElement | null>;
  onChoose: (assistant: FollowUpAssistant) => void;
  onCopyQuestion: () => void;
  onSetUpFollowed: () => void;
  onClose: () => void;
}

const ASSISTANTS = FollowUpAssistant.options;

function OptionDetail({ assistant, connected }: { assistant: FollowUpAssistant; connected: boolean }) {
  if (connected && FOLLOW_UP_ASSISTANTS[assistant].prefillParam !== null)
    return (
      <>
        <span className={styles.connected}>
          <StrokeIcon name="plug" size={15} />
          Connected
        </span>{" "}
        · reads this note and its transcript
      </>
    );
  return FOLLOW_UP_ASSISTANTS[assistant].prefillParam === null
    ? "Copies the question and this note; you paste it in"
    : "Gets this note in the link";
}

// Design 266s–266v: a menu under the tapped question, or a sheet on a phone and in the panel.
// The assistants are a radio group with focus managed as ChoicePicker's; Escape or a tap
// outside closes it with nothing remembered.
export function FollowUpAssistantMenu({
  firstTap,
  chosen,
  connectedTo,
  anyConnection,
  asSheet,
  top,
  inside,
  onChoose,
  onCopyQuestion,
  onSetUpFollowed,
  onClose,
}: FollowUpAssistantMenuProps) {
  const title = firstTap ? ASK_IN_TITLE : CHANGE_TITLE;
  const titleId = useId();
  const menu = useRef<HTMLDivElement | null>(null);
  const sheet = useRef<HTMLDialogElement | null>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const focusedAt = Math.max(0, chosen === null ? 0 : ASSISTANTS.indexOf(chosen));

  useDismissOnOutside(!asSheet, onClose, menu, inside);

  useEffect(() => {
    if (asSheet && sheet.current !== null && !sheet.current.open) sheet.current.showModal();
    options.current[focusedAt]?.focus({ preventScroll: true });
    if (!asSheet) menu.current?.scrollIntoView?.({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [asSheet, focusedAt]);

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = options.current.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    const last = ASSISTANTS.length - 1;
    const target = {
      ArrowDown: current === last ? 0 : current + 1,
      ArrowRight: current === last ? 0 : current + 1,
      ArrowUp: current === 0 ? last : current - 1,
      ArrowLeft: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    options.current[target]?.focus();
  };

  const body = (
    <div
      className={`${styles.menu} ${asSheet ? styles.inSheet : ""}`}
      ref={menu}
      role={asSheet ? undefined : "dialog"}
      aria-labelledby={titleId}
      style={asSheet ? undefined : ({ "--top": `${top}px` } as CSSProperties)}
      data-testid={followUpAssistantMenuTestIds.root}
    >
      {asSheet && <span className={styles.handle} aria-hidden="true" />}
      <p className={styles.title} id={titleId}>
        {title}
      </p>
      <div role="radiogroup" aria-label="Assistant" onKeyDown={moveFocus}>
        {ASSISTANTS.map((assistant, index) => (
          <button
            key={assistant}
            type="button"
            role="radio"
            aria-checked={assistant === chosen}
            tabIndex={index === focusedAt ? 0 : -1}
            ref={(element) => {
              options.current[index] = element;
            }}
            className={styles.option}
            onClick={() => onChoose(assistant)}
            data-testid={followUpAssistantMenuTestIds.option(assistant)}
          >
            <span className={`${styles.dot} ${assistant === chosen ? styles.dotOn : ""}`} aria-hidden="true" />
            <b className={styles.name}>{FOLLOW_UP_ASSISTANTS[assistant].name}</b>
            <small className={styles.detail}>
              <OptionDetail assistant={assistant} connected={connectedTo(assistant)} />
            </small>
          </button>
        ))}
      </div>
      {firstTap && (
        <>
          <p className={styles.remembered}>Remembered for next time. Change it under the questions.</p>
          <hr className={styles.rule} />
          <button type="button" className={styles.copy} onClick={onCopyQuestion} data-testid={followUpAssistantMenuTestIds.copyQuestion}>
            <StrokeIcon name="copy" size={17} />
            Copy question
          </button>
          {!anyConnection && (
            <div className={styles.setUp} data-testid={followUpAssistantMenuTestIds.setUpNote}>
              {SET_UP_NOTE}
              <br />
              <PageLink
                to={Routes.settingsSection("connections")}
                className={styles.setUpLink}
                onClick={onSetUpFollowed}
                data-testid={followUpAssistantMenuTestIds.setUpLink}
              >
                <StrokeIcon name="plug" size={15} />
                Set up a connection
              </PageLink>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (!asSheet) return body;
  return createPortal(
    <dialog
      ref={sheet}
      className={styles.sheet}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === sheet.current) onClose();
      }}
      data-testid={followUpAssistantMenuTestIds.sheet}
    >
      {body}
    </dialog>,
    document.body,
  );
}
