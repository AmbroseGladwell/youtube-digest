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
export const ANSWER_QUESTIONS_TITLE = "Answer questions";
export const CONTINUE_IN_TITLE = "Continue in";
export const HERE_DETAIL = "From the video, with the moments it’s from";
export const HERE_FOOT = "Remembered on every overview. The box below always asks here.";
export const SET_UP_NOTE =
  "Connect your assistant to The Overview and it can read the whole transcript, search your library, save to projects and more.";

export interface FollowUpAssistantMenuProps {
  // The first tap asks as soon as one is picked, and offers Copy question; Change only chooses (266s, 266v).
  firstTap: boolean;
  // A chat answer's "Continue in…" with no assistant chosen: hands the conversation on as soon as
  // one is picked (design 310p).
  continueIn?: boolean;
  chosen: FollowUpAssistant | null;
  // Where chat is offered, Here comes first and may be the choice (design 310f-2).
  offerHere: boolean;
  hereChosen: boolean;
  connectedTo: (assistant: FollowUpAssistant) => boolean;
  anyConnection: boolean;
  asSheet: boolean;
  // On the web the menu centres under what opened it, or sits at the end of a header (design 324z-2).
  align?: "centre" | "end";
  // Where the menu stands, from the top of the block, when it floats on the web.
  top: number;
  inside: RefObject<HTMLElement | null>;
  onChoose: (assistant: FollowUpAssistant) => void;
  onChooseHere: () => void;
  onCopyQuestion: () => void;
  onSetUpFollowed: () => void;
  onClose: () => void;
}

type Option = "here" | FollowUpAssistant;

interface OptionDetailProps {
  assistant: FollowUpAssistant;
  connected: boolean;
  continueIn: boolean;
}

const OptionDetail = ({ assistant, connected, continueIn }: OptionDetailProps) => {
  if (connected && FOLLOW_UP_ASSISTANTS[assistant].prefillParam !== null) {
    return (
      <>
        <span className={styles.connected}>
          <StrokeIcon name="plug" size={15} />
          Connected
        </span>{" "}
        · reads this note and its transcript
      </>
    );
  }
  if (continueIn) {
    return FOLLOW_UP_ASSISTANTS[assistant].prefillParam === null
      ? "Copies this conversation; you paste it in"
      : "Opens with this conversation filled in";
  }
  return FOLLOW_UP_ASSISTANTS[assistant].prefillParam === null
    ? "Copies the question and this note; you paste it in"
    : "Gets this note in the link";
};

// Design 266s–266v: a menu under the tapped question, or a sheet on a phone and in the panel.
// The assistants are a radio group with focus managed as ChoicePicker's; Escape or a tap
// outside closes it with nothing remembered.
export const FollowUpAssistantMenu = ({
  firstTap,
  continueIn = false,
  align = "centre",
  chosen,
  offerHere,
  hereChosen,
  connectedTo,
  anyConnection,
  asSheet,
  top,
  inside,
  onChoose,
  onChooseHere,
  onCopyQuestion,
  onSetUpFollowed,
  onClose,
}: FollowUpAssistantMenuProps) => {
  const title = continueIn ? CONTINUE_IN_TITLE : firstTap ? ASK_IN_TITLE : offerHere ? ANSWER_QUESTIONS_TITLE : CHANGE_TITLE;
  const choices: readonly Option[] = offerHere ? ["here", ...FollowUpAssistant.options] : FollowUpAssistant.options;
  const checked: Option | null = offerHere && hereChosen ? "here" : chosen;
  const titleId = useId();
  const menu = useRef<HTMLDivElement | null>(null);
  const sheet = useRef<HTMLDialogElement | null>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const focusedAt = Math.max(0, checked === null ? 0 : choices.indexOf(checked));

  useDismissOnOutside(!asSheet, onClose, menu, inside);

  useEffect(() => {
    if (asSheet && sheet.current !== null && !sheet.current.open) {
      sheet.current.showModal();
    }
    options.current[focusedAt]?.focus({ preventScroll: true });
    if (!asSheet) {
      menu.current?.scrollIntoView?.({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  }, [asSheet, focusedAt]);

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = options.current.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) {
      return;
    }
    const last = choices.length - 1;
    const target = {
      ArrowDown: current === last ? 0 : current + 1,
      ArrowRight: current === last ? 0 : current + 1,
      ArrowUp: current === 0 ? last : current - 1,
      ArrowLeft: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    options.current[target]?.focus();
  };

  const body = (
    <div
      className={`${styles.menu} ${asSheet ? styles.inSheet : align === "end" ? styles.alignEnd : ""}`}
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
      <div role="radiogroup" aria-label={offerHere ? "Where questions are answered" : "Assistant"} onKeyDown={moveFocus}>
        {choices.map((option, index) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === checked}
            tabIndex={index === focusedAt ? 0 : -1}
            ref={(element) => {
              options.current[index] = element;
            }}
            className={styles.option}
            onClick={() => {
              if (option === "here") {
                onChooseHere();
              } else {
                onChoose(option);
              }
            }}
            data-testid={followUpAssistantMenuTestIds.option(option)}
          >
            <span className={`${styles.dot} ${option === checked ? styles.dotOn : ""}`} aria-hidden="true" />
            <b className={styles.name}>{option === "here" ? "Here" : FOLLOW_UP_ASSISTANTS[option].name}</b>
            <small className={styles.detail}>
              {option === "here" ? (
                HERE_DETAIL
              ) : (
                <OptionDetail assistant={option} connected={connectedTo(option)} continueIn={continueIn} />
              )}
            </small>
          </button>
        ))}
      </div>
      {offerHere && !firstTap && (
        <p className={styles.remembered} data-testid={followUpAssistantMenuTestIds.hereFoot}>
          {HERE_FOOT}
        </p>
      )}
      {(firstTap || continueIn) && (
        <>
          <p className={styles.remembered}>
            {continueIn
              ? "Remembered for next time. Change it in Settings › Connections."
              : "Remembered for next time. Change it under the questions."}
          </p>
          {!continueIn && (
            <>
              <hr className={styles.rule} />
              <button
                type="button"
                className={styles.copy}
                onClick={onCopyQuestion}
                data-testid={followUpAssistantMenuTestIds.copyQuestion}
              >
                <StrokeIcon name="copy" size={17} />
                Copy question
              </button>
            </>
          )}
          {!anyConnection && (
            <div className={styles.setUp} data-testid={followUpAssistantMenuTestIds.setUpNote}>
              {SET_UP_NOTE}
              <br />
              <PageLink
                to={Routes.settingsSection("connections")}
                state={{ fromQuestion: true }}
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

  if (!asSheet) {
    return body;
  }
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
        if (event.target === sheet.current) {
          onClose();
        }
      }}
      data-testid={followUpAssistantMenuTestIds.sheet}
    >
      {body}
    </dialog>,
    document.body,
  );
};
