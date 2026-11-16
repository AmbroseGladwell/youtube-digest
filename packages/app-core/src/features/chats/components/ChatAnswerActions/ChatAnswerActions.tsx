import { useRef, useState } from "react";
import { FOLLOW_UP_ASSISTANTS, chatHandOffPrompt, followUpHandOff, type Chat, type FollowUpAssistant, type Overview } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { FollowUpAssistantMenu } from "../../../reader/components/FollowUpAssistantMenu/FollowUpAssistantMenu.js";
import { useFollowUpAssistant } from "../../../reader/useFollowUpAssistant.js";
import { copyText, handOffFollowUp } from "../../../reader/util/handOffFollowUp.js";
import styles from "./ChatAnswerActions.module.scss";
import { chatAnswerActionsTestIds } from "./ChatAnswerActionsTestIds.js";

export interface ChatAnswerActionsProps {
  chat: Chat;
  overview: Overview;
  answer: string;
  compact: boolean;
  onSaid: (text: string, done: boolean) => void;
}

// Design 310k, 310p: under the latest answer, Copy and "Continue in {assistant}", which opens the
// reader's assistant with the note and this conversation, or asks which with none chosen.
export function ChatAnswerActions({ chat, overview, answer, compact, onSaid }: ChatAnswerActionsProps) {
  const { assistant, connectedTo, anyConnection, choose } = useFollowUpAssistant();
  const analytics = useAnalytics();
  const [menuOpen, setMenuOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const continueButton = useRef<HTMLButtonElement | null>(null);

  const continueIn = (to: FollowUpAssistant) => {
    const connected = connectedTo(to);
    const handOff = followUpHandOff(to, chatHandOffPrompt(chat, overview, connected));
    const name = FOLLOW_UP_ASSISTANTS[to].name;
    analytics.reader.chat.continuedIn({ overviewId: overview.id, assistant: to, handOff: handOff.kind, connected });
    void handOffFollowUp(handOff).then((copied) => {
      if (handOff.kind === "prefill") onSaid(`Opening ${name} in a new tab`, true);
      else
        onSaid(
          copied ? `Copied. ${name} is opening in a new tab: paste it there.` : `That couldn’t be copied. ${name} is opening in a new tab.`,
          copied,
        );
    });
  };

  const copy = () => {
    analytics.reader.chat.answerCopied({ overviewId: overview.id });
    void copyText(answer).then((copied) => onSaid(copied ? "Answer copied" : "That couldn’t be copied.", copied));
  };

  const closeMenu = () => {
    setMenuOpen(false);
    continueButton.current?.focus();
  };

  return (
    <div className={styles.root} ref={root} data-testid={chatAnswerActionsTestIds.root}>
      <button type="button" className={styles.copy} aria-label="Copy answer" onClick={copy} data-testid={chatAnswerActionsTestIds.copy}>
        <StrokeIcon name="copy" size={14} />
      </button>
      {assistant === null ? (
        <button
          type="button"
          ref={continueButton}
          className={styles.jump}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
          data-testid={chatAnswerActionsTestIds.continueIn}
        >
          Continue in…
          <StrokeIcon name="chevronDown" size={15} />
        </button>
      ) : (
        <>
          <button
            type="button"
            ref={continueButton}
            className={styles.jump}
            aria-label={`Continue in ${FOLLOW_UP_ASSISTANTS[assistant].name} (opens in a new tab)`}
            onClick={() => continueIn(assistant)}
            data-testid={chatAnswerActionsTestIds.continueIn}
          >
            Continue in {FOLLOW_UP_ASSISTANTS[assistant].name}
            <StrokeIcon name="openOut" size={15} />
          </button>
          {connectedTo(assistant) && (
            <span className={styles.connected} data-testid={chatAnswerActionsTestIds.connected}>
              <StrokeIcon name="plug" size={15} />
              connected
            </span>
          )}
        </>
      )}
      {menuOpen && (
        <FollowUpAssistantMenu
          firstTap={false}
          continueIn={true}
          chosen={null}
          offerHere={false}
          hereChosen={false}
          connectedTo={connectedTo}
          anyConnection={anyConnection}
          asSheet={compact}
          top={root.current?.offsetHeight ?? 0}
          inside={root}
          onChoose={(to) => {
            choose(to, false);
            closeMenu();
            continueIn(to);
          }}
          onChooseHere={() => undefined}
          onCopyQuestion={() => undefined}
          onSetUpFollowed={() => undefined}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
