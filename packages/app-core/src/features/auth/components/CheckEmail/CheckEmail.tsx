import { MAGIC_LINK_TTL_MINUTES, type AuthIntent } from "@overview/domain";
import { AuthScreen } from "../AuthScreen/AuthScreen.js";
import { ResendLinkButton } from "../ResendLinkButton/ResendLinkButton.js";
import styles from "./CheckEmail.module.scss";
import { checkEmailTestIds } from "./CheckEmailTestIds.js";

export interface CheckEmailProps {
  email: string;
  intent: AuthIntent;
  firstName: string | null;
  sentAt: number;
  resending: boolean;
  onDifferentEmail: () => void;
  onResend: () => void;
}

// Design 9c: what happens next, and the two ways out of waiting.
export function CheckEmail({ email, intent, firstName, sentAt, resending, onDifferentEmail, onResend }: CheckEmailProps) {
  const creating = intent === "createAccount";
  return (
    <AuthScreen
      testId={checkEmailTestIds.root}
      icon="mail"
      kicker={creating && firstName !== null ? `Thanks, ${firstName}.` : undefined}
      title="Check your email"
      lead={
        creating ? (
          <>
            Open the link we sent to <strong data-testid={checkEmailTestIds.email}>{email}</strong> to finish
            creating your account. It works once, for the next {MAGIC_LINK_TTL_MINUTES} minutes.
          </>
        ) : (
          <>
            We sent a sign-in link to <strong data-testid={checkEmailTestIds.email}>{email}</strong>. It works once,
            for the next {MAGIC_LINK_TTL_MINUTES} minutes.
          </>
        )
      }
    >
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          onClick={onDifferentEmail}
          data-testid={checkEmailTestIds.differentEmailButton}
        >
          Use a different email
        </button>
        <ResendLinkButton sentAt={sentAt} sending={resending} onResend={onResend} />
      </div>
      <p className={styles.note}>
        Nothing there? Check your spam folder. You can close this tab. The link opens a new one.
      </p>
    </AuthScreen>
  );
}
