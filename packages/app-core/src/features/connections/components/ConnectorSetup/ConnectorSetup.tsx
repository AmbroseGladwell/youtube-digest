import { forwardRef, useEffect, useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./ConnectorSetup.module.scss";
import { connectorSetupTestIds } from "./ConnectorSetupTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

export interface ConnectorSetupProps {
  label: string;
  address: string;
}

const STEPS = [
  "In Claude, open Settings › Connectors and choose Add custom connector.",
  "Paste the address above and add it.",
  "Claude sends you here. Sign in if asked, then approve.",
];

const COPIED_FOR_MS = 2500;

// The address an assistant is given, and the three steps for Claude (design 58k). Copy is
// offered only where the browser lets a page write to the clipboard.
export const ConnectorSetup = forwardRef<HTMLParagraphElement, ConnectorSetupProps>(function ConnectorSetup(
  { label, address },
  labelRef,
) {
  const [copied, setCopied] = useState(false);
  const canCopy = typeof navigator !== "undefined" && navigator.clipboard?.writeText !== undefined;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FOR_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const analytics = useAnalytics();
  const copy = () => {
    void navigator.clipboard.writeText(address).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <div className={styles.root} data-testid={connectorSetupTestIds.root}>
      <p className={styles.label} ref={labelRef} tabIndex={-1}>
        {label}
      </p>
      <div className={styles.addressGroup}>
        <p className={styles.addressLabel}>Connector address</p>
        <div className={styles.addressField}>
          <span className={styles.address} data-testid={connectorSetupTestIds.address}>
            {address}
          </span>
          {canCopy &&
            (copied ? (
              <span className={styles.copied} role="status" data-testid={connectorSetupTestIds.copied}>
                <StrokeIcon name="check" size={14} />
                Copied
              </span>
            ) : (
              <button
                type="button"
                className={styles.copy}
                aria-label="Copy connector address"
                onClick={() => {
                  analytics.mcp.settingsConnections.addressCopied();
                  copy();
                }}
                data-testid={connectorSetupTestIds.copyButton}
              >
                <StrokeIcon name="copy" size={14} />
                Copy
              </button>
            ))}
        </div>
      </div>
      <ol className={styles.steps} aria-label="Connect Claude">
        {STEPS.map((step, index) => (
          <li key={step} className={styles.step} data-testid={connectorSetupTestIds.step}>
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            <span className={styles.stepText}>{step}</span>
          </li>
        ))}
      </ol>
      <p className={styles.note}>Any assistant that takes an MCP connector address works the same way.</p>
    </div>
  );
});
