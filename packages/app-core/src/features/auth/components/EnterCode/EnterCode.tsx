import { useId, useState, type FormEvent } from "react";
import { LINK_CODE_TTL_MINUTES } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { AuthScreen } from "../AuthScreen/AuthScreen.js";
import { ResendLinkButton } from "../ResendLinkButton/ResendLinkButton.js";
import styles from "./EnterCode.module.scss";
import { enterCodeTestIds } from "./EnterCodeTestIds.js";

interface EnterCodeCommonProps {
  connecting: boolean;
  refused: string | null;
  onConnect: (code: string) => void;
}

export type EnterCodeProps = EnterCodeCommonProps &
  (
    | { from: "emailLink"; email: string; sentAt: number; resending: boolean; onDifferentEmail: () => void; onResend: () => void }
    | { from: "webApp"; onEmailInstead: () => void }
  );

// Design 10c/10d: the link opens a tab that shows a code, and the code comes back here.
// Reopening the panel lands here again until the code is used or could no longer work
// (docs/features/sign-in.md, "Waiting for the code"). A code the signed-in web app made
// comes in the same way, with no email behind it.
export function EnterCode(props: EnterCodeProps) {
  const { connecting, refused, onConnect } = props;
  const fromEmail = props.from === "emailLink";
  const ids = useId();
  const [code, setCode] = useState("");
  const [empty, setEmpty] = useState(false);
  const problem = empty
    ? fromEmail
      ? "Enter the code from the page the link opened."
      : "Enter the code the web app shows."
    : refused;

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
        fromEmail ? (
          <>
            Open the link we sent to <strong data-testid={enterCodeTestIds.email}>{props.email}</strong>. The page
            it opens shows an 8-character code.
          </>
        ) : (
          "In the web app, where you're signed in, open the account menu and choose Connect the extension. It shows an 8-character code."
        )
      }
    >
      <form className={styles.form} onSubmit={connect} noValidate>
        <label className={styles.label}>
          <span className={styles.labelText}>{fromEmail ? "Code from the email link" : "Code from the web app"}</span>
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
          {fromEmail ? (
            <>
              <button
                type="button"
                className={styles.secondary}
                onClick={props.onDifferentEmail}
                data-testid={enterCodeTestIds.differentEmailButton}
              >
                Use a different email
              </button>
              <ResendLinkButton
                sentAt={props.sentAt}
                sending={props.resending}
                label="Email me a new link"
                onResend={props.onResend}
              />
            </>
          ) : (
            <button
              type="button"
              className={styles.secondary}
              onClick={props.onEmailInstead}
              data-testid={enterCodeTestIds.emailInsteadButton}
            >
              Email me a link instead
            </button>
          )}
        </div>

        <div className={styles.footer}>
          <p className={styles.note}>
            {refused === null && fromEmail
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
