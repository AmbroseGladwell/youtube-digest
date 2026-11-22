import { useId, useState, type FormEvent, type ReactNode } from "react";
import { LINK_CODE_TTL_MINUTES, MAGIC_LINK_TTL_MINUTES, type AuthIntent } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { AuthScreen } from "../AuthScreen/AuthScreen.js";
import { isUrl } from "../../util/isUrl.js";
import { ResendLinkButton } from "../ResendLinkButton/ResendLinkButton.js";
import styles from "./EnterCode.module.scss";
import { enterCodeTestIds } from "./EnterCodeTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

const CODE_CHARACTERS = 8;

interface EnterCodeCommonProps {
  connecting: boolean;
  refused: string | null;
  onConnect: (code: string, serverUrl: string | null) => void;
}

export type EnterCodeProps = EnterCodeCommonProps &
  (
    | { from: "emailLink"; email: string; sentAt: number; resending: boolean; onDifferentEmail: () => void; onResend: () => void }
    | {
        from: "emailCode";
        intent: AuthIntent;
        codeFirst?: boolean;
        email: string;
        sentAt: number;
        resending: boolean;
        onDifferentEmail: () => void;
        onResend: () => void;
      }
    | { from: "webApp"; initialServerUrl: string | null; onEmailInstead: () => void }
  );

const EMPTY_CODE_PROBLEM: Record<EnterCodeProps["from"], string> = {
  emailCode: "Enter the code from the email.",
  emailLink: "Enter the code from the page the link opened.",
  webApp: "Enter the code the web app shows.",
};

const CODE_LABEL: Record<EnterCodeProps["from"], string> = {
  emailCode: "Code from the email",
  emailLink: "Code from the email link",
  webApp: "Code from the web app",
};

const leadOf = (props: EnterCodeProps, codeFirst: boolean): ReactNode => {
  if (props.from === "webApp") {
    return "In the web app, where you're signed in, open the account menu and choose Connect the extension. It shows an 8-character code.";
  }
  if (codeFirst) {
    return (
      <>
        <strong data-testid={enterCodeTestIds.email}>{props.email}</strong>
        <br />
        It confirms it’s you. There’s no password.
      </>
    );
  }
  if (props.from === "emailCode") {
    return (
      <>
        The email we sent to <strong data-testid={enterCodeTestIds.email}>{props.email}</strong> has an 8-character code under the link.
        Type it here to sign in this browser.
      </>
    );
  }
  return (
    <>
      Open the link we sent to <strong data-testid={enterCodeTestIds.email}>{props.email}</strong>. The page it opens shows an 8-character
      code.
    </>
  );
};

interface NoteFacts {
  codeFirst: boolean;
  inMail: boolean;
  fromEmail: boolean;
  refused: string | null;
}

const noteOf = ({ codeFirst, inMail, fromEmail, refused }: NoteFacts): string => {
  if (codeFirst) {
    return `Or tap the link in the email. The code works once, for ${MAGIC_LINK_TTL_MINUTES} minutes after we sent it.`;
  }
  if (inMail) {
    return `The code works once, for ${MAGIC_LINK_TTL_MINUTES} minutes after we sent it.`;
  }
  if (refused === null && fromEmail) {
    return "You can close this panel to open your email. It'll be waiting here when you come back.";
  }
  return `Codes work once, for ${LINK_CODE_TTL_MINUTES} minutes.`;
};

const submitLabelOf = (props: EnterCodeProps): string => {
  if (props.from !== "emailCode") {
    return "Connect";
  }
  return props.intent === "createAccount" ? "Create account" : "Sign in";
};

// Why reopening the panel lands here: docs/features/sign-in.md, "Waiting for the code".
export const EnterCode = (props: EnterCodeProps) => {
  const { connecting, refused, onConnect } = props;
  const fromEmail = props.from !== "webApp";
  const inMail = props.from === "emailCode";
  const codeFirst = props.from === "emailCode" && props.codeFirst === true;
  const ids = useId();
  const [code, setCode] = useState("");
  const analytics = useAnalytics();
  const [empty, setEmpty] = useState(false);
  const [serverUrl, setServerUrl] = useState(props.from === "webApp" ? (props.initialServerUrl ?? "") : "");
  const [serverShown, setServerShown] = useState(props.from === "webApp" && props.initialServerUrl === null);
  const [serverInvalid, setServerInvalid] = useState(false);
  const problem = empty ? EMPTY_CODE_PROBLEM[props.from] : refused;

  const connect = (event: FormEvent) => {
    event.preventDefault();
    if (serverShown && !isUrl(serverUrl.trim())) {
      setServerInvalid(true);
      return;
    }
    setServerInvalid(false);
    if (code.trim() === "") {
      setEmpty(true);
      return;
    }
    setEmpty(false);
    analytics.account.signIn.codeSubmitted({ from: props.from });
    onConnect(code.trim(), serverShown ? serverUrl.trim() : null);
  };
  const typed = (value: string) => {
    setCode(value);
    if (codeFirst && !connecting && value.replace(/[^A-Za-z0-9]/g, "").length === CODE_CHARACTERS) {
      analytics.account.signIn.codeSubmitted({ from: props.from });
      onConnect(value.trim(), null);
    }
  };

  return (
    <AuthScreen
      testId={enterCodeTestIds.root}
      embedded={codeFirst}
      title={codeFirst ? "Enter the code we sent to" : "Enter your code"}
      lead={leadOf(props, codeFirst)}
    >
      <form className={`${styles.form} ${codeFirst ? styles.codeFirst : ""}`} onSubmit={connect} noValidate>
        {serverShown && (
          <label className={styles.label}>
            <span className={styles.labelText}>Server address</span>
            <span className={`${styles.field} ${serverInvalid ? styles.fieldInvalid : ""}`}>
              <StrokeIcon name="link" size={16} />
              <input
                id={`${ids}-server`}
                name="server-url"
                className={styles.input}
                type="url"
                autoComplete="off"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                aria-invalid={serverInvalid}
                aria-describedby={serverInvalid ? `${ids}-server-error` : undefined}
                data-testid={enterCodeTestIds.serverInput}
              />
            </span>
            {serverInvalid && (
              <span className={styles.error} id={`${ids}-server-error`} data-testid={enterCodeTestIds.serverError}>
                <StrokeIcon name="alertCircle" size={14} />
                The server address has to be a URL.
              </span>
            )}
          </label>
        )}
        <label className={styles.label}>
          <span className={styles.labelText}>{CODE_LABEL[props.from]}</span>
          <input
            id={`${ids}-code`}
            name="one-time-code"
            className={`${styles.code} ${problem !== null ? styles.codeInvalid : ""}`}
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={9}
            placeholder="XXXX-XXXX"
            value={code}
            onChange={(event) => typed(event.target.value)}
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

        {!fromEmail && !serverShown && (
          <button
            type="button"
            className={styles.quiet}
            onClick={() => {
              analytics.account.signIn.serverFieldShown();
              setServerShown(true);
            }}
            data-testid={enterCodeTestIds.otherServerButton}
          >
            Use a different server
          </button>
        )}

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
                label={inMail ? "Email me a new code" : "Email me a new link"}
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
          <p className={styles.note}>{noteOf({ codeFirst, inMail, fromEmail, refused })}</p>
          <button type="submit" className={styles.submit} disabled={connecting} data-testid={enterCodeTestIds.connectButton}>
            {submitLabelOf(props)}
          </button>
        </div>
      </form>
    </AuthScreen>
  );
};
