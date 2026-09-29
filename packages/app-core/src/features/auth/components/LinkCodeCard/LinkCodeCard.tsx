import { useState } from "react";
import { LINK_CODE_TTL_MINUTES } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { AuthScreen } from "../AuthScreen/AuthScreen.js";
import styles from "./LinkCodeCard.module.scss";
import { linkCodeCardTestIds } from "./LinkCodeCardTestIds.js";

export interface LinkCodeCardProps {
  code: string;
}

const canWriteClipboard = (): boolean => typeof navigator.clipboard?.writeText === "function";

const spokenCode = (code: string): string =>
  code
    .split("-")
    .map((part) => part.split("").join(" "))
    .join(", ");

// Design 9g: the tab a link asked for from the extension opens in is the messenger. It
// shows the code and signs nothing in here (docs/features/sign-in.md).
export function LinkCodeCard({ code }: LinkCodeCardProps) {
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
      lead="Type this into The Overview's panel, where you asked for the link."
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
      <p className={styles.note} data-testid={linkCodeCardTestIds.staysSignedOutNote}>
        This tab stays signed out. The link was for the extension, so the overviews saved in this browser aren't
        added to your account.
      </p>
      <p className={styles.visuallyHidden} aria-live="polite">
        {copied ? "Code copied" : ""}
      </p>
    </AuthScreen>
  );
}
