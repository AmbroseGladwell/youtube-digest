import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { dismissAccountOffer } from "../../useDeviceAccountHistory.js";
import type { AccountStripKind } from "../../useAccountStripKind.js";
import styles from "./AccountStrip.module.scss";
import { accountStripTestIds } from "./AccountStripTestIds.js";

export interface AccountStripProps {
  kind: AccountStripKind;
  panel?: boolean;
}

const COPY = {
  signedOut: {
    icon: "monitor",
    title: "Signed out.",
    body: "Sign in to sync your Overviews and unlock more features.",
    action: "Sign in",
    to: Routes.signIn(),
  },
  offer: {
    icon: "userPlus",
    title: "Sync across devices.",
    body: "Create an account to keep your Overviews on every device and unlock more features.",
    action: "Create account",
    to: Routes.createAccount(),
  },
} as const;

// Designs 47a and 47c: plain text in the generation strip's slot, never an alert. The
// signed-out strip stays as long as the state does; the offer can be turned down, because
// this reader may never want an account (docs/features/account-libraries.md).
export function AccountStrip({ kind, panel = false }: AccountStripProps) {
  const copy = COPY[kind];
  return (
    <div
      className={`${styles.root} ${panel ? styles.panel : ""}`}
      data-kind={kind}
      data-testid={accountStripTestIds.root}
    >
      <span className={styles.text}>
        <span className={styles.icon}>
          <StrokeIcon name={copy.icon} size={16} />
        </span>
        <span className={styles.words}>
          <span className={styles.title}>{copy.title}</span>{" "}
          <span className={styles.body}>{copy.body}</span>
        </span>
      </span>
      <span className={styles.actions}>
        <Link className={styles.action} to={copy.to} data-testid={accountStripTestIds.action}>
          {copy.action}
        </Link>
        {kind === "offer" && (
          <button
            type="button"
            className={styles.dismiss}
            onClick={dismissAccountOffer}
            aria-label="Dismiss"
            data-testid={accountStripTestIds.dismiss}
          >
            <StrokeIcon name="close" size={16} />
          </button>
        )}
      </span>
    </div>
  );
}
