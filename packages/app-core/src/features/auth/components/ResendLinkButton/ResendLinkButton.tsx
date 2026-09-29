import { useEffect, useState } from "react";
import { MAGIC_LINK_COOLDOWN_SECONDS } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { formatClock } from "../../../../util/formatClock.js";
import styles from "./ResendLinkButton.module.scss";
import { resendLinkButtonTestIds } from "./ResendLinkButtonTestIds.js";

export interface ResendLinkButtonProps {
  sentAt: number;
  sending: boolean;
  label?: string;
  onResend: () => void;
}

const secondsLeft = (sentAt: number, now: number): number =>
  Math.max(0, Math.ceil((sentAt + MAGIC_LINK_COOLDOWN_SECONDS * 1000 - now) / 1000));

// The server sends nothing inside its one-a-minute cooldown, so the button waits it out
// with a clock rather than offering a send that would silently do nothing
// (docs/features/sign-in.md).
export function ResendLinkButton({ sentAt, sending, label = "Send another link", onResend }: ResendLinkButtonProps) {
  const [now, setNow] = useState(() => Date.now());
  const waiting = secondsLeft(sentAt, now);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (secondsLeft(sentAt, current) === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [sentAt]);

  if (waiting > 0) {
    return (
      <span className={styles.waiting} data-testid={resendLinkButtonTestIds.countdown}>
        <StrokeIcon name="clock" size={15} />
        Send another in {formatClock(waiting)}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={styles.resend}
      onClick={onResend}
      disabled={sending}
      data-testid={resendLinkButtonTestIds.button}
    >
      {label}
    </button>
  );
}
