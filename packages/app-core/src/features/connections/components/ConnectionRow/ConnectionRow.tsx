import { useEffect, useRef, useState } from "react";
import type { Connection } from "@overview/domain";
import { connectionUseLine } from "../../util/connectionUseLine.js";
import styles from "./ConnectionRow.module.scss";
import { connectionRowTestIds } from "./ConnectionRowTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

export interface ConnectionRowProps {
  connection: Connection;
  now: Date;
  onRevoke: (connectionId: string) => void;
}

// Revoking cannot be undone, so the row asks once and says so (design 58i, 58j).
export function ConnectionRow({ connection, now, onRevoke }: ConnectionRowProps) {
  const analytics = useAnalytics();
  const [confirming, setConfirming] = useState(false);
  const [returned, setReturned] = useState(false);
  const confirmTitle = useRef<HTMLParagraphElement>(null);
  const revokeButton = useRef<HTMLButtonElement>(null);
  const name = connection.clientName?.trim() || null;
  const titleId = `connection-${connection.id}-revoke`;

  useEffect(() => {
    if (confirming) confirmTitle.current?.focus();
    else if (returned) revokeButton.current?.focus();
  }, [confirming, returned]);

  if (confirming) {
    return (
      <li className={styles.confirm} role="group" aria-labelledby={titleId} data-testid={connectionRowTestIds.confirm}>
        <p className={styles.confirmTitle} id={titleId} ref={confirmTitle} tabIndex={-1}>
          {name === null ? "Revoke this assistant?" : `Revoke “${name}”?`}
        </p>
        <p className={styles.confirmBody}>
          It loses access to your overviews straight away. There’s no undo: to use it again, you’d connect it from
          {name === null ? " the assistant" : ` ${name}`} from scratch.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.revokeAccess}
            onClick={() => onRevoke(connection.id)}
            data-testid={connectionRowTestIds.revokeAccessButton}
          >
            Revoke access
          </button>
          <button
            type="button"
            className={styles.keep}
            onClick={() => {
              analytics.mcp.settingsConnections.revokeKept();
              setReturned(true);
              setConfirming(false);
            }}
            data-testid={connectionRowTestIds.keepButton}
          >
            Keep it
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className={styles.root} data-testid={connectionRowTestIds.root}>
      <span className={styles.text}>
        <span className={`${styles.name} ${name === null ? styles.unnamed : ""}`} data-testid={connectionRowTestIds.name}>
          {name ?? "No name given"}
        </span>
        <span className={styles.useLine} data-testid={connectionRowTestIds.useLine}>
          {connectionUseLine(connection, now)}
        </span>
      </span>
      <button
        type="button"
        ref={revokeButton}
        className={styles.revoke}
        aria-label={name === null ? "Revoke unnamed assistant" : `Revoke ${name}`}
        onClick={() => {
          analytics.mcp.settingsConnections.revokeAsked();
          setConfirming(true);
        }}
        data-testid={connectionRowTestIds.revokeButton}
      >
        Revoke
      </button>
    </li>
  );
}
