import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { WaitCopy } from "../../util/chatWaitCopy.js";
import styles from "./ChatWaitBlock.module.scss";
import { chatWaitBlockTestIds } from "./ChatWaitBlockTestIds.js";

export interface ChatWaitBlockProps {
  copy: WaitCopy;
  onNewConversation: () => void;
  onPlansFollowed: () => void;
}

// Design 310ad–310ah, OV-104's at-limit pattern: the wait takes the field's place, names what ran
// out and when it's back, and offers only routes that exist. Announced politely; focus stays put.
export function ChatWaitBlock({ copy, onNewConversation, onPlansFollowed }: ChatWaitBlockProps) {
  const { icon, heading, body, action } = copy;
  return (
    <div className={styles.root} role="status" data-testid={chatWaitBlockTestIds.root}>
      <p className={styles.heading} data-testid={chatWaitBlockTestIds.heading}>
        <StrokeIcon name={icon} size={18} />
        {heading}
      </p>
      <p className={styles.body} data-testid={chatWaitBlockTestIds.body}>
        {body}
      </p>
      {action !== null && (
        <div className={styles.actions}>
          {action.kind === "newConversation" ? (
            <button type="button" className={styles.make} onClick={onNewConversation} data-testid={chatWaitBlockTestIds.action}>
              <StrokeIcon name="pencil" size={15} />
              {action.label}
            </button>
          ) : (
            <PageLink
              className={styles.outlined}
              to={Routes.settingsSection("plan")}
              onClick={onPlansFollowed}
              data-testid={chatWaitBlockTestIds.action}
            >
              {action.label}
            </PageLink>
          )}
        </div>
      )}
    </div>
  );
}
