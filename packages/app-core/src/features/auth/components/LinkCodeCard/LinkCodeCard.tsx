import { useState } from "react";
import { LINK_CODE_TTL_MINUTES } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { AuthScreen } from "../AuthScreen/AuthScreen.js";
import styles from "./LinkCodeCard.module.scss";
import { linkCodeCardTestIds } from "./LinkCodeCardTestIds.js";

export type LinkCodeCardProps =
  | { code: string; from: "emailLink" }
  | { code: string; from: "webApp"; onNewCode: () => void };

const canWriteClipboard = (): boolean => typeof navigator.clipboard?.writeText === "function";

const spokenCode = (code: string): string =>
  code
    .split("-")
    .map((part) => part.split("").join(" "))
    .join(", ");

// Design 9g: the tab a link asked for from the extension opens in is the messenger. It
// shows the code and signs nothing in here. The same card shows the code a signed-in web
// app mints for the extension beside it (docs/features/sign-in.md).
export function LinkCodeCard(props: LinkCodeCardProps) {
  const { code } = props;
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => setCopied(true));
  };

  return (
    <AuthScreen
      testId={linkCodeCardTestIds.root}
      icon="puzzle"
      title="Your code for the extension"
      compactTitle
      lead={
        props.from === "emailLink"
          ? "Type this into The Overview's panel, where you asked for the link."
          : "In The Overview's panel, choose Sign in, then Enter a code from the web app, and type this in."
      }
    >
      <div className={styles.card}>
        <span className={styles.code} aria-label={spokenCode(code)} data-testid={linkCodeCardTestIds.code}>
          {code}
        </span>
        {canWriteClipboard() && (
          <button type="button" className={styles.copy} onClick={copy} data-testid={linkCodeCardTestIds.copyButton}>
            <StrokeIcon name={copied ? "check" : "copy"} size={15} />
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <p className={styles.expiry}>Works once, for {LINK_CODE_TTL_MINUTES} minutes.</p>
      {props.from === "emailLink" ? (
        <p className={styles.note} data-testid={linkCodeCardTestIds.staysSignedOutNote}>
          This tab stays signed out. The link was for the extension, so the overviews saved in this browser aren't
          added to your account.
        </p>
      ) : (
        <>
          <p className={styles.note} data-testid={linkCodeCardTestIds.sameAccountNote}>
            The extension joins the account this browser is signed in to. No email needed.
          </p>
          <button
            type="button"
            className={styles.newCode}
            onClick={props.onNewCode}
            data-testid={linkCodeCardTestIds.newCodeButton}
          >
            Get a new code
          </button>
        </>
      )}
      <p className={styles.visuallyHidden} aria-live="polite">
        {copied ? "Code copied" : ""}
      </p>
    </AuthScreen>
  );
}
