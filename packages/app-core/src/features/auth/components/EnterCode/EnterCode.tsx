import { useId, useState, type FormEvent } from "react";
import { LINK_CODE_TTL_MINUTES } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { AuthScreen } from "../AuthScreen/AuthScreen.js";
import { ResendLinkButton } from "../ResendLinkButton/ResendLinkButton.js";
import styles from "./EnterCode.module.scss";
import { enterCodeTestIds } from "./EnterCodeTestIds.js";

export interface EnterCodeProps {
  email: string;
  sentAt: number;
  connecting: boolean;
  resending: boolean;
  refused: string | null;
  onConnect: (code: string) => void;
  onDifferentEmail: () => void;
  onResend: () => void;
}

// Design 10c/10d: the link opens a tab that shows a code, and the code comes back here.
// Reopening the panel lands here again until the code is used or could no longer work
// (docs/features/sign-in.md, "Waiting for the code").
export function EnterCode({
  email,
  sentAt,
  connecting,
  resending,
  refused,
  onConnect,
  onDifferentEmail,
  onResend,
}: EnterCodeProps) {
  const ids = useId();
  const [code, setCode] = useState("");
  const [empty, setEmpty] = useState(false);
  const problem = empty ? "Enter the code from the page the link opened." : refused;

  const connect = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim() === "") {
      setEmpty(true);
      return;
    }
    setEmpty(false);
    onConnect(code.trim());
  };

  return (
    <AuthScreen
      testId={enterCodeTestIds.root}
      title="Enter your code"
      lead={
        <>
          Open the link we sent to <strong data-testid={enterCodeTestIds.email}>{email}</strong>. The page it opens
          shows an 8-character code.
        </>
      }
    >
      <form className={styles.form} onSubmit={connect} noValidate>
        <label className={styles.label}>
          <span className={styles.labelText}>Code from the email link</span>
          <input
            className={`${styles.code} ${problem !== null ? styles.codeInvalid : ""}`}
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={9}
            placeholder="XXXX-XXXX"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-invalid={problem !== null}
            aria-describedby={problem === null ? undefined : `${ids}-error`}
            data-testid={enterCodeTestIds.codeInput}
          />
          {problem !== null && (
            <span className={styles.error} id={`${ids}-error`} data-testid={enterCodeTestIds.error}>
              <StrokeIcon name="alertCircle" size={14} />
              {problem}
            </span>
          )}
        </label>

        <div className={styles.linkActions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={onDifferentEmail}
            data-testid={enterCodeTestIds.differentEmailButton}
          >
            Use a different email
          </button>
          <ResendLinkButton sentAt={sentAt} sending={resending} label="Email me a new link" onResend={onResend} />
        </div>

        <div className={styles.footer}>
          <p className={styles.note}>
            {refused === null
              ? "You can close this panel to open your email. It'll be waiting here when you come back."
              : `Codes work once, for ${LINK_CODE_TTL_MINUTES} minutes.`}
          </p>
          <button
            type="submit"
            className={styles.submit}
            disabled={connecting}
            data-testid={enterCodeTestIds.connectButton}
          >
            Connect
          </button>
        </div>
      </form>
    </AuthScreen>
  );
}
